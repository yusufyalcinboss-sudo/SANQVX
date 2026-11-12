assert(plugin, "SANQVX must be installed as a Roblox Studio plugin")

local Selection = game:GetService("Selection")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")

local toolbar = plugin:CreateToolbar("SANQVX")
local toggleButton = toolbar:CreateButton(
	"SANQVX",
	"Open the SANQVX Studio script workspace",
	""
)
toggleButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Left,
	true,
	false,
	780,
	620,
	560,
	420
)
local widget = plugin:CreateDockWidgetPluginGuiAsync("SANQVX.ScriptWorkspace", widgetInfo)
widget.Title = "SANQVX | Studio Workspace"

local colors = {
	background = Color3.fromRGB(8, 12, 22),
	panel = Color3.fromRGB(14, 21, 36),
	panelAlt = Color3.fromRGB(19, 29, 48),
	text = Color3.fromRGB(222, 234, 250),
	muted = Color3.fromRGB(123, 146, 177),
	success = Color3.fromRGB(94, 230, 177),
	error = Color3.fromRGB(255, 112, 132),
	accents = {
		Color3.fromRGB(54, 166, 255),
		Color3.fromRGB(130, 102, 255),
		Color3.fromRGB(31, 218, 210),
	},
}
local accentIndex = 1
local accentColor = colors.accents[accentIndex]
local themeTargets = {}
local tabs = {}
local activeTabIndex = 0
local loadingEditor = false
local statusLabel

local function make(className, properties, parent)
	local instance = Instance.new(className)
	for property, value in pairs(properties) do
		instance[property] = value
	end
	instance.Parent = parent
	return instance
end

local function addStroke(target, color, thickness)
	local stroke = make("UIStroke", {
		Color = color or accentColor,
		Thickness = thickness or 1,
		Transparency = 0.35,
	}, target)
	if color == nil then
		table.insert(themeTargets, {instance = stroke, kind = "stroke"})
	end
	return stroke
end

local function rounded(target, radius)
	make("UICorner", {CornerRadius = UDim.new(0, radius or 8)}, target)
end

local function setStatus(message, isError)
	statusLabel.Text = message
	statusLabel.TextColor3 = if isError then colors.error else colors.success
end

local root = make("Frame", {
	Name = "Root",
	BackgroundColor3 = colors.background,
	BorderSizePixel = 0,
	Size = UDim2.fromScale(1, 1),
}, widget)

local topBar = make("Frame", {
	BackgroundColor3 = colors.panel,
	BorderSizePixel = 0,
	Size = UDim2.new(1, 0, 0, 72),
}, root)
addStroke(topBar, accentColor, 1)

local logo = make("TextLabel", {
	BackgroundTransparency = 1,
	Position = UDim2.fromOffset(18, 8),
	Size = UDim2.new(0, 245, 0, 35),
	Font = Enum.Font.GothamBlack,
	Text = "S A N Q V X",
	TextColor3 = accentColor,
	TextSize = 23,
	TextXAlignment = Enum.TextXAlignment.Left,
}, topBar)

make("TextLabel", {
	BackgroundTransparency = 1,
	Position = UDim2.fromOffset(20, 42),
	Size = UDim2.new(0, 300, 0, 18),
	Font = Enum.Font.Code,
	Text = "STUDIO SCRIPT WORKSPACE  //  LUAU",
	TextColor3 = colors.muted,
	TextSize = 10,
	TextXAlignment = Enum.TextXAlignment.Left,
}, topBar)

local themeButton = make("TextButton", {
	AutoButtonColor = true,
	BackgroundColor3 = accentColor,
	BorderSizePixel = 0,
	Position = UDim2.new(1, -122, 0, 18),
	Size = UDim2.fromOffset(104, 34),
	Font = Enum.Font.GothamBold,
	Text = "THEME  /  01",
	TextColor3 = colors.background,
	TextSize = 11,
}, topBar)
rounded(themeButton, 8)
table.insert(themeTargets, {instance = themeButton, kind = "button"})

local content = make("Frame", {
	BackgroundTransparency = 1,
	Position = UDim2.fromOffset(12, 84),
	Size = UDim2.new(1, -24, 1, -126),
}, root)

local searchPanel = make("Frame", {
	BackgroundColor3 = colors.panel,
	BorderSizePixel = 0,
	Size = UDim2.new(0, 238, 1, 0),
}, content)
rounded(searchPanel, 10)
addStroke(searchPanel)

make("TextLabel", {
	BackgroundTransparency = 1,
	Position = UDim2.fromOffset(14, 12),
	Size = UDim2.new(1, -28, 0, 22),
	Font = Enum.Font.GothamBold,
	Text = "SMART SEARCH",
	TextColor3 = colors.text,
	TextSize = 12,
	TextXAlignment = Enum.TextXAlignment.Left,
}, searchPanel)

local searchBox = make("TextBox", {
	BackgroundColor3 = colors.panelAlt,
	BorderSizePixel = 0,
	ClearTextOnFocus = false,
	Position = UDim2.fromOffset(12, 43),
	Size = UDim2.new(1, -24, 0, 36),
	Font = Enum.Font.Code,
	PlaceholderColor3 = colors.muted,
	PlaceholderText = "Find scripts or code...",
	Text = "",
	TextColor3 = colors.text,
	TextSize = 12,
	TextXAlignment = Enum.TextXAlignment.Left,
}, searchPanel)
rounded(searchBox, 7)
make("UIPadding", {
	PaddingLeft = UDim.new(0, 10),
	PaddingRight = UDim.new(0, 8),
}, searchBox)

local searchButton = make("TextButton", {
	AutoButtonColor = true,
	BackgroundColor3 = accentColor,
	BorderSizePixel = 0,
	Position = UDim2.fromOffset(12, 88),
	Size = UDim2.new(1, -24, 0, 32),
	Font = Enum.Font.GothamBold,
	Text = "SEARCH STUDIO",
	TextColor3 = colors.background,
	TextSize = 11,
}, searchPanel)
rounded(searchButton, 7)
table.insert(themeTargets, {instance = searchButton, kind = "button"})

make("TextLabel", {
	BackgroundTransparency = 1,
	Position = UDim2.fromOffset(14, 128),
	Size = UDim2.new(1, -28, 0, 26),
	Font = Enum.Font.Gotham,
	Text = "Names, classes and source text",
	TextColor3 = colors.muted,
	TextSize = 10,
	TextXAlignment = Enum.TextXAlignment.Left,
}, searchPanel)

local results = make("ScrollingFrame", {
	Active = true,
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	CanvasSize = UDim2.new(),
	Position = UDim2.fromOffset(8, 158),
	ScrollBarImageColor3 = accentColor,
	ScrollBarThickness = 4,
	Size = UDim2.new(1, -16, 1, -168),
}, searchPanel)
make("UIListLayout", {
	Padding = UDim.new(0, 6),
	SortOrder = Enum.SortOrder.LayoutOrder,
}, results)

local editorPanel = make("Frame", {
	BackgroundColor3 = colors.panel,
	BorderSizePixel = 0,
	Position = UDim2.new(0, 250, 0, 0),
	Size = UDim2.new(1, -250, 1, 0),
}, content)
rounded(editorPanel, 10)
addStroke(editorPanel)

local tabStrip = make("ScrollingFrame", {
	Active = true,
	AutomaticCanvasSize = Enum.AutomaticSize.X,
	BackgroundColor3 = colors.panelAlt,
	BorderSizePixel = 0,
	CanvasSize = UDim2.new(),
	ScrollBarThickness = 2,
	ScrollBarImageColor3 = accentColor,
	Size = UDim2.new(1, 0, 0, 38),
}, editorPanel)
rounded(tabStrip, 8)
local tabLayout = make("UIListLayout", {
	FillDirection = Enum.FillDirection.Horizontal,
	Padding = UDim.new(0, 4),
	SortOrder = Enum.SortOrder.LayoutOrder,
}, tabStrip)
tabLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
	tabStrip.CanvasSize = UDim2.new(0, tabLayout.AbsoluteContentSize.X + 8, 0, 0)
end)

local editor = make("TextBox", {
	BackgroundColor3 = Color3.fromRGB(9, 14, 25),
	BorderSizePixel = 0,
	ClearTextOnFocus = false,
	Font = Enum.Font.Code,
	MultiLine = true,
	PlaceholderColor3 = colors.muted,
	PlaceholderText = "-- Select a Script, LocalScript or ModuleScript to begin.",
	Position = UDim2.fromOffset(10, 48),
	Size = UDim2.new(1, -20, 1, -112),
	Text = "",
	TextColor3 = colors.text,
	TextSize = 13,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
}, editorPanel)
rounded(editor, 7)
make("UIPadding", {
	PaddingTop = UDim.new(0, 10),
	PaddingLeft = UDim.new(0, 10),
	PaddingRight = UDim.new(0, 10),
	PaddingBottom = UDim.new(0, 10),
}, editor)

local actionBar = make("Frame", {
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 10, 1, -54),
	Size = UDim2.new(1, -20, 0, 42),
}, editorPanel)
make("UIListLayout", {
	FillDirection = Enum.FillDirection.Horizontal,
	Padding = UDim.new(0, 7),
	SortOrder = Enum.SortOrder.LayoutOrder,
}, actionBar)

local function actionButton(label, emphasized, width)
	local button = make("TextButton", {
		AutoButtonColor = true,
		BackgroundColor3 = if emphasized then accentColor else colors.panelAlt,
		BorderSizePixel = 0,
		Size = UDim2.new(0, width or 82, 1, 0),
		Font = Enum.Font.GothamBold,
		Text = label,
		TextColor3 = if emphasized then colors.background else colors.text,
		TextSize = 10,
	}, actionBar)
	rounded(button, 7)
	if emphasized then
		table.insert(themeTargets, {instance = button, kind = "button"})
	end
	return button
end

local saveButton = actionButton("SAVE", true, 70)
local refreshButton = actionButton("REFRESH", false, 78)
local executeButton = actionButton("OPEN IN STUDIO", true, 120)
local clearButton = actionButton("CLEAR", false, 68)
local newButton = actionButton("+ MODULE", false, 82)

local footer = make("Frame", {
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 12, 1, -34),
	Size = UDim2.new(1, -24, 0, 24),
}, root)

statusLabel = make("TextLabel", {
	BackgroundTransparency = 1,
	Size = UDim2.new(0.5, 0, 1, 0),
	Font = Enum.Font.Code,
	Text = "Ready. Select a Studio script to edit.",
	TextColor3 = colors.muted,
	TextSize = 10,
	TextXAlignment = Enum.TextXAlignment.Left,
}, footer)

make("TextLabel", {
	BackgroundTransparency = 1,
	Position = UDim2.new(0.5, 0, 0, 0),
	Size = UDim2.new(0.5, 0, 1, 0),
	Font = Enum.Font.Code,
	Text = "SAVE  >  TEST  >  PLAY  |  STUDIO CONTROLS EXECUTION",
	TextColor3 = colors.muted,
	TextSize = 9,
	TextXAlignment = Enum.TextXAlignment.Right,
}, footer)

local function isScript(instance)
	return instance:IsA("Script") or instance:IsA("LocalScript") or instance:IsA("ModuleScript")
end

local function sourceOf(scriptInstance)
	return ScriptEditorService:GetEditorSource(scriptInstance)
end

local function updateTabButton(tab)
	if tab.button and tab.button.Parent then
		tab.button.Text = (tab.dirty and "* " or "") .. tab.instance.Name
	end
end

local function refreshTabButtons()
	for _, child in ipairs(tabStrip:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end

	for index, tab in ipairs(tabs) do
		local button = make("TextButton", {
			AutoButtonColor = true,
			BackgroundColor3 = if index == activeTabIndex then colors.background else colors.panelAlt,
			BorderSizePixel = 0,
			LayoutOrder = index,
			Size = UDim2.new(0, 138, 0, 32),
			Font = Enum.Font.Code,
			Text = (tab.dirty and "* " or "") .. tab.instance.Name,
			TextColor3 = if index == activeTabIndex then accentColor else colors.muted,
			TextSize = 11,
			TextTruncate = Enum.TextTruncate.AtEnd,
		}, tabStrip)
		rounded(button, 6)
		tab.button = button
		button.Activated:Connect(function()
			loadingEditor = true
			activeTabIndex = index
			editor.Text = tab.source
			loadingEditor = false
			refreshTabButtons()
			setStatus("Editing " .. tab.instance:GetFullName(), false)
		end)
	end
end

local function openTab(scriptInstance)
	if not isScript(scriptInstance) then
		setStatus("Select a Script, LocalScript or ModuleScript.", true)
		return
	end

	for index, tab in ipairs(tabs) do
		if tab.instance == scriptInstance then
			activeTabIndex = index
			loadingEditor = true
			editor.Text = tab.source
			loadingEditor = false
			refreshTabButtons()
			setStatus("Editing " .. scriptInstance:GetFullName(), false)
			return
		end
	end

	local ok, source = pcall(sourceOf, scriptInstance)
	if not ok then
		setStatus("Could not read script source: " .. tostring(source), true)
		return
	end

	table.insert(tabs, {instance = scriptInstance, source = source, dirty = false})
	activeTabIndex = #tabs
	loadingEditor = true
	editor.Text = source
	loadingEditor = false
	refreshTabButtons()
	setStatus("Editing " .. scriptInstance:GetFullName(), false)
end

local function activeTab()
	return tabs[activeTabIndex]
end

local function saveActive()
	local tab = activeTab()
	if not tab then
		setStatus("Open a Studio script before saving.", true)
		return false
	end
	if not tab.instance.Parent then
		setStatus("This script was removed from the DataModel.", true)
		return false
	end

	local newSource = editor.Text
	local ok, err = pcall(function()
		ScriptEditorService:UpdateSourceAsync(tab.instance, function()
			return newSource
		end)
	end)
	if not ok then
		setStatus("Save failed: " .. tostring(err), true)
		return false
	end

	tab.source = newSource
	tab.dirty = false
	refreshTabButtons()
	setStatus("Saved " .. tab.instance.Name, false)
	return true
end

editor:GetPropertyChangedSignal("Text"):Connect(function()
	if loadingEditor then
		return
	end
	local tab = activeTab()
	if tab then
		tab.source = editor.Text
		tab.dirty = true
		updateTabButton(tab)
		statusLabel.Text = "Unsaved changes in " .. tab.instance.Name
		statusLabel.TextColor3 = accentColor
	end
end)

saveButton.Activated:Connect(saveActive)

refreshButton.Activated:Connect(function()
	local tab = activeTab()
	if not tab then
		setStatus("Open a script before refreshing.", true)
		return
	end
	local ok, source = pcall(sourceOf, tab.instance)
	if not ok then
		setStatus("Refresh failed: " .. tostring(source), true)
		return
	end
	tab.source = source
	tab.dirty = false
	loadingEditor = true
	editor.Text = source
	loadingEditor = false
	refreshTabButtons()
	setStatus("Reloaded from Studio: " .. tab.instance.Name, false)
end)

executeButton.Activated:Connect(function()
	local tab = activeTab()
	if not tab then
		setStatus("Open a script before sending it to the Studio editor.", true)
		return
	end
	if tab.dirty and not saveActive() then
		return
	end
	local ok, opened, err = pcall(function()
		return ScriptEditorService:OpenScriptDocumentAsync(tab.instance)
	end)
	if not ok then
		setStatus("Studio editor could not open this script: " .. tostring(err), true)
		return
	end
	if not opened then
		setStatus("Studio editor could not open this script: " .. tostring(err), true)
		return
	end
	setStatus("Saved and opened. Use Studio Test > Play to execute in your project.", false)
end)

clearButton.Activated:Connect(function()
	if not activeTab() then
		setStatus("Open a script before clearing the editor.", true)
		return
	end
	editor.Text = ""
	editor:CaptureFocus()
end)

newButton.Activated:Connect(function()
	local parent = ServerScriptService
	local selection = Selection:Get()
	if #selection > 0 then
		local selected = selection[1]
		if selected:IsA("Folder") or selected:IsA("Model") or selected.Parent == game then
			parent = selected
		end
	end

	local module = Instance.new("ModuleScript")
	module.Name = "NewModule"
	module.Source = "-- SANQVX Luau module\n\n"
	module.Parent = parent
	Selection:Set({module})
	openTab(module)
end)

local function showSearchResults(query)
	for _, child in ipairs(results:GetChildren()) do
		if child:IsA("TextButton") or child:IsA("TextLabel") then
			child:Destroy()
		end
	end

	local needle = string.lower(string.gsub(query, "^%s*(.-)%s*$", "%1"))
	if needle == "" then
		setStatus("Enter a name, class or code fragment to search.", true)
		return
	end

	local matches = {}
	local readFailures = 0
	for _, instance in ipairs(game:GetDescendants()) do
		if isScript(instance) then
			local nameMatch = string.find(string.lower(instance.Name), needle, 1, true) ~= nil
			local classMatch = string.find(string.lower(instance.ClassName), needle, 1, true) ~= nil
			local sourceMatch = false
			if not nameMatch and not classMatch then
				local ok, source = pcall(sourceOf, instance)
				if ok then
					sourceMatch = string.find(string.lower(source), needle, 1, true) ~= nil
				else
					readFailures += 1
				end
			end
			if nameMatch or classMatch or sourceMatch then
				table.insert(matches, {
					instance = instance,
					reason = if nameMatch then "NAME" elseif classMatch then "TYPE" else "SOURCE",
				})
			end
		end
	end

	for index, match in ipairs(matches) do
		local scriptInstance = match.instance
		local resultButton = make("TextButton", {
			AutoButtonColor = true,
			BackgroundColor3 = colors.panelAlt,
			BorderSizePixel = 0,
			LayoutOrder = index,
			Size = UDim2.new(1, -4, 0, 50),
			Font = Enum.Font.Gotham,
			Text = scriptInstance.Name .. "\n" .. match.reason .. "  /  " .. scriptInstance.ClassName,
			TextColor3 = colors.text,
			TextSize = 10,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextYAlignment = Enum.TextYAlignment.Center,
			TextTruncate = Enum.TextTruncate.AtEnd,
		}, results)
		rounded(resultButton, 7)
		make("UIPadding", {PaddingLeft = UDim.new(0, 9)}, resultButton)
		resultButton.Activated:Connect(function()
			openTab(scriptInstance)
			Selection:Set({scriptInstance})
		end)
	end

	if #matches == 0 then
		make("TextLabel", {
			BackgroundTransparency = 1,
			LayoutOrder = 1,
			Size = UDim2.new(1, -8, 0, 42),
			Font = Enum.Font.Gotham,
			Text = "No matching scripts found.",
			TextColor3 = colors.muted,
			TextSize = 11,
		}, results)
	end

	local message = string.format("%d script result(s).", #matches)
	if readFailures > 0 then
		message ..= string.format(" %d source(s) could not be searched.", readFailures)
	end
	setStatus(message, readFailures > 0)
end

searchButton.Activated:Connect(function()
	showSearchResults(searchBox.Text)
end)
searchBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		showSearchResults(searchBox.Text)
	end
end)

themeButton.Activated:Connect(function()
	accentIndex = (accentIndex % #colors.accents) + 1
	accentColor = colors.accents[accentIndex]
	themeButton.Text = string.format("THEME  /  %02d", accentIndex)
	for _, target in ipairs(themeTargets) do
		if target.instance.Parent then
			if target.kind == "stroke" then
				target.instance.Color = accentColor
			elseif target.kind == "button" then
				target.instance.BackgroundColor3 = accentColor
			end
		end
	end
	logo.TextColor3 = accentColor
	results.ScrollBarImageColor3 = accentColor
	tabStrip.ScrollBarImageColor3 = accentColor
	if activeTab() then
		refreshTabButtons()
	end
end)

toggleButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

Selection.SelectionChanged:Connect(function()
	if widget.Enabled then
		local selected = Selection:Get()
		if #selected == 1 and isScript(selected[1]) then
			openTab(selected[1])
		end
	end
end)

widget:BindToClose(function()
	widget.Enabled = false
end)
