# Makefile Panel Runner

A Visual Studio Code extension that adds a **Makefile Scripts** panel to the Activity Bar.
It automatically detects targets in a `Makefile` and lets you run them with one click — just like the NPM Scripts panel.

![Preview](./preview.png)

## Features

- 🛠 Detects all top-level Makefile targets
- ▶️ One-click to run `make <target>` in detached mode
- ⏸️ Stop running make targets with stop button
- 🔄 Running indicator with spinning icon
- 👁️ Watch mode support for continuous builds
- ⚙️ Configurable terminal behavior
- 🎯 Singleton or multiple terminal support
- 📦 Output channels instead of visible terminals (hidden by default)
- 🔧 Click target to open in Makefile
- 🔍 No configuration required

## Configuration

The extension provides the following settings (accessible via Settings → Extensions → Makefile Runner):

- `makefileRunner.singletonTerminal`: Use a single terminal for all make commands (default: `true`)
- `makefileRunner.showTerminal`: Automatically show terminal/output when running make commands (default: `false`)
- `makefileRunner.watchMode`: Enable watch mode for make targets (default: `false`)

## Usage

1. Open a workspace containing a `Makefile`
2. Look for the **Make Runner** icon in the Activity Bar (left sidebar)
3. Click any target to open it in the Makefile, or click the play ▶️ button to run it
4. Running targets show a spinning icon 🔄
5. Click the stop ⏹️ button to stop a running target
6. Use the watch 👁️ button in the panel title to toggle watch mode

## How It Works

1. Opens `Makefile` in your workspace
2. Parses lines like: `build:`, `test:`, `run:`
3. Adds clickable entries in the **Make Targets** panel
4. Runs make commands in detached processes for better control
5. Shows output in dedicated output channels (not visible terminals)

## Limitations
- Doesn't support .PHONY, dependencies, or multi-line targets (yet)
- Assumes GNU make is installed and available in PATH
