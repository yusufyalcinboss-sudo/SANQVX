(() => {
  "use strict";

  const form = document.querySelector("#key-form");
  const input = document.querySelector("#access-key");
  const submit = document.querySelector("#key-submit");
  const status = document.querySelector("#key-status");

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  function localWorkspace() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  async function checkSession() {
    if (localWorkspace()) {
      document.body.classList.add("authenticated");
      return;
    }

    try {
      const response = await fetch("/api/verify-key", {credentials: "same-origin", cache: "no-store"});
      if (!response.ok) {
        if (response.status !== 401) setStatus("The access service is unavailable. Open this app from its Vercel deployment.", true);
        return;
      }
      const result = await response.json();
      if (result.authenticated === true) document.body.classList.add("authenticated");
    } catch {
      setStatus("The access service is unavailable. Open this app from its Vercel deployment.", true);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    setStatus("Checking key...");
    try {
      const response = await fetch("/api/verify-key", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({key: input.value}),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) setStatus("That key is not correct.", true);
        else setStatus(result.error || "The access service is unavailable.", true);
        return;
      }
      const result = await response.json();
      if (result.authenticated !== true) {
        setStatus("That key is not correct.", true);
        return;
      }
      input.value = "";
      document.body.classList.add("authenticated");
    } catch {
      setStatus("Could not reach the access service. Check your connection and try again.", true);
    } finally {
      submit.disabled = false;
    }
  });

  checkSession();
})();
