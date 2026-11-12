using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SANQVX;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        using var server = new LocalWebServer();
        using var window = new MainWindow(server.Address);
        Application.Run(window);
    }
}

internal sealed class MainWindow : Form
{
    private readonly string _address;
    private readonly WebView2 _browser = new() { Dock = DockStyle.Fill };

    public MainWindow(string address)
    {
        _address = address;
        Text = "SANQVX — Studio Workspace";
        Width = 1440;
        Height = 920;
        MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(_browser);
        Load += InitializeBrowserAsync;
    }

    private async void InitializeBrowserAsync(object? sender, EventArgs e)
    {
        try
        {
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SANQVX",
                "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            await _browser.EnsureCoreWebView2Async(environment);
            _browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _browser.CoreWebView2.NavigationStarting += (_, args) =>
            {
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) ||
                    uri.Host != "127.0.0.1" ||
                    uri.Port != new Uri(_address).Port)
                {
                    args.Cancel = true;
                }
            };
            _browser.CoreWebView2.Navigate(_address);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"SANQVX could not start its embedded browser.{Environment.NewLine}{Environment.NewLine}" +
                $"{error.Message}{Environment.NewLine}{Environment.NewLine}" +
                "Install the Microsoft Edge WebView2 Runtime, then try again.",
                "SANQVX startup error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }
}

internal sealed class LocalWebServer : IDisposable
{
    private static readonly IReadOnlyDictionary<string, (string Resource, string ContentType)> Files =
        new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["/"] = ("Web.index.html", "text/html; charset=utf-8"),
            ["/index.html"] = ("Web.index.html", "text/html; charset=utf-8"),
            ["/styles.css"] = ("Web.styles.css", "text/css; charset=utf-8"),
            ["/auth.js"] = ("Web.auth.js", "text/javascript; charset=utf-8"),
            ["/app.js"] = ("Web.app.js", "text/javascript; charset=utf-8"),
            ["/sw.js"] = ("Web.sw.js", "text/javascript; charset=utf-8"),
            ["/manifest.webmanifest"] = ("Web.manifest.webmanifest", "application/manifest+json; charset=utf-8"),
            ["/icon.svg"] = ("Web.icon.svg", "image/svg+xml")
        };

    private readonly TcpListener _listener;
    private readonly CancellationTokenSource _shutdown = new();
    private readonly Task _acceptLoop;

    public string Address { get; }

    public LocalWebServer()
    {
        _listener = new TcpListener(IPAddress.Loopback, 0);
        _listener.Start();
        var port = ((IPEndPoint)_listener.LocalEndpoint).Port;
        Address = $"http://127.0.0.1:{port}/";
        _acceptLoop = AcceptConnectionsAsync();
    }

    public void Dispose()
    {
        _shutdown.Cancel();
        _listener.Stop();
        try
        {
            _acceptLoop.GetAwaiter().GetResult();
        }
        catch (SocketException)
        {
        }
        catch (ObjectDisposedException)
        {
        }
        _shutdown.Dispose();
    }

    private async Task AcceptConnectionsAsync()
    {
        while (!_shutdown.IsCancellationRequested)
        {
            try
            {
                var client = await _listener.AcceptTcpClientAsync(_shutdown.Token);
                _ = HandleConnectionAsync(client, _shutdown.Token);
            }
            catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
            {
                break;
            }
            catch (SocketException) when (_shutdown.IsCancellationRequested)
            {
                break;
            }
            catch (ObjectDisposedException) when (_shutdown.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private static async Task HandleConnectionAsync(TcpClient client, CancellationToken cancellationToken)
    {
        using (client)
        {
            try
            {
                var stream = client.GetStream();
                using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true);
                var requestLine = await reader.ReadLineAsync(cancellationToken);
                var request = requestLine?.Split(' ', 3);
                var method = request?.Length == 3 ? request[0] : "";
                var target = request?.Length == 3 ? request[1] : "";

                string? header;
                while (!string.IsNullOrEmpty(header = await reader.ReadLineAsync(cancellationToken)))
                {
                }

                if (method is not ("GET" or "HEAD") ||
                    !Uri.TryCreate($"http://127.0.0.1{target}", UriKind.Absolute, out var uri) ||
                    !Files.TryGetValue(uri.AbsolutePath, out var file))
                {
                    await WriteResponseAsync(stream, 404, "Not Found", "text/plain; charset=utf-8",
                        Encoding.UTF8.GetBytes("Not found"), method == "HEAD", cancellationToken);
                    return;
                }

                await using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(file.Resource)
                    ?? throw new InvalidOperationException($"Missing embedded app resource: {file.Resource}");
                using var content = new MemoryStream();
                await resource.CopyToAsync(content, cancellationToken);
                await WriteResponseAsync(stream, 200, "OK", file.ContentType, content.ToArray(),
                    method == "HEAD", cancellationToken);
            }
            catch (IOException)
            {
                Debug.WriteLine("The browser closed a connection before its response completed.");
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
            }
        }
    }

    private static async Task WriteResponseAsync(
        NetworkStream stream,
        int statusCode,
        string reason,
        string contentType,
        byte[] content,
        bool headersOnly,
        CancellationToken cancellationToken)
    {
        var headers = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {statusCode} {reason}\r\n" +
            $"Content-Type: {contentType}\r\n" +
            $"Content-Length: {content.Length}\r\n" +
            "Cache-Control: no-cache\r\n" +
            "X-Content-Type-Options: nosniff\r\n" +
            "Connection: close\r\n\r\n");
        await stream.WriteAsync(headers, cancellationToken);
        if (!headersOnly)
        {
            await stream.WriteAsync(content, cancellationToken);
        }
    }
}
