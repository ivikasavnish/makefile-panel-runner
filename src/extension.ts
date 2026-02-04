import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";

// Global state for running processes
const runningProcesses: Map<string, cp.ChildProcess> = new Map();
let watchModeEnabled = false;

export function activate(context: vscode.ExtensionContext) {
  const makefileProvider = new MakefileTreeProvider();

  vscode.window.registerTreeDataProvider("makefileScripts", makefileProvider);
  
  vscode.commands.registerCommand("makefileRunner.refresh", () =>
    makefileProvider.refresh()
  );
  
  vscode.commands.registerCommand("makefileRunner.toggleWatch", () => {
    watchModeEnabled = !watchModeEnabled;
    const message = watchModeEnabled 
      ? "Watch mode enabled - terminals will stay open"
      : "Watch mode disabled";
    vscode.window.showInformationMessage(message);
  });
  
  vscode.commands.registerCommand(
    "makefileRunner.runTarget",
    async (target: string | MakeTarget) => {
      // Handle both string and MakeTarget object
      const targetName = typeof target === "string" ? target : target.label;
      
      // Get configuration
      const config = vscode.workspace.getConfiguration("makefileRunner");
      const useSingleton = config.get<boolean>("singletonTerminal", true);
      const showTerminal = config.get<boolean>("showTerminal", false);
      const watchMode = config.get<boolean>("watchMode", false) || watchModeEnabled;
      
      // Mark target as running if it's a MakeTarget object
      if (typeof target !== "string") {
        target.setRunning(true);
        makefileProvider.refresh();
      }
      
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }
      
      const cwd = workspaceFolders[0].uri.fsPath;
      
      // Use detached process for better control
      try {
        // Run in detached mode
        const child = cp.spawn("make", watchMode ? [targetName, "watch"] : [targetName], {
          cwd: cwd,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        
        // Store the process
        runningProcesses.set(targetName, child);
        
        // Create output channel for the target
        const outputChannel = vscode.window.createOutputChannel(`Make: ${targetName}`);
        
        child.stdout?.on("data", (data) => {
          outputChannel.append(data.toString());
        });
        
        child.stderr?.on("data", (data) => {
          outputChannel.append(data.toString());
        });
        
        child.on("exit", (code) => {
          runningProcesses.delete(targetName);
          if (typeof target !== "string") {
            target.setRunning(false);
            makefileProvider.refresh();
          }
          
          if (code === 0) {
            outputChannel.appendLine(`\n✓ Make target '${targetName}' completed successfully`);
          } else {
            outputChannel.appendLine(`\n✗ Make target '${targetName}' failed with code ${code}`);
          }
        });
        
        // Show output channel only if configured to show terminal
        if (showTerminal) {
          outputChannel.show(true);
        }
        
        vscode.window.showInformationMessage(`Running make ${targetName}...`);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to run make: ${error}`);
        if (typeof target !== "string") {
          target.setRunning(false);
          makefileProvider.refresh();
        }
      }
    }
  );
  
  vscode.commands.registerCommand(
    "makefileRunner.stopTarget",
    (target: MakeTarget) => {
      const targetName = target.label;
      const process = runningProcesses.get(targetName);
      
      if (process) {
        // Kill the process group (negative PID kills the entire group)
        try {
          if (process.pid) {
            // Kill the entire process group
            process.kill("SIGTERM");
            // Also attempt to kill the process group if on Unix-like systems
            if (require("os").platform() !== "win32") {
              try {
                cp.execSync(`kill -TERM -${process.pid}`);
              } catch {
                // Ignore errors if process group is already dead
              }
            }
          }
          runningProcesses.delete(targetName);
          target.setRunning(false);
          makefileProvider.refresh();
          vscode.window.showInformationMessage(`Stopped make ${targetName}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to stop make: ${error}`);
        }
      }
    }
  );
  
  vscode.commands.registerCommand(
    "makefileRunner.openTarget",
    async (target: MakeTarget) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      const makefilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        "Makefile"
      );
      const makefileUri = vscode.Uri.file(makefilePath);

      try {
        const document = await vscode.workspace.openTextDocument(makefileUri);
        const editor = await vscode.window.showTextDocument(document);

        // Navigate to the specific line
        const position = new vscode.Position(target.lineNumber, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      } catch (error) {
        vscode.window.showErrorMessage(`Could not open Makefile: ${error}`);
      }
    }
  );

  // Function to check if Makefile exists and set context
  async function updateMakefileContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      await vscode.commands.executeCommand(
        "setContext",
        "makefileRunner.hasMakefile",
        false
      );
      return;
    }

    const makefilePath = path.join(workspaceFolders[0].uri.fsPath, "Makefile");
    const hasMakefile = fs.existsSync(makefilePath);

    console.log(`Makefile check: ${makefilePath} exists: ${hasMakefile}`);

    await vscode.commands.executeCommand(
      "setContext",
      "makefileRunner.hasMakefile",
      hasMakefile
    );

    if (hasMakefile) {
      makefileProvider.refresh();
    }
  }

  // Set up file watcher for Makefile changes
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const makefilePattern = new vscode.RelativePattern(
      workspaceFolders[0],
      "Makefile"
    );
    const watcher = vscode.workspace.createFileSystemWatcher(makefilePattern);

    // Refresh when Makefile is created, changed, or deleted
    watcher.onDidCreate(() => {
      updateMakefileContext();
    });
    watcher.onDidChange(() => {
      makefileProvider.refresh();
    });
    watcher.onDidDelete(() => {
      updateMakefileContext();
    });

    // Clean up the watcher when extension is deactivated
    context.subscriptions.push(watcher);
  }

  // Also watch for workspace folder changes
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    updateMakefileContext();
  });

  // Initial check - delay it slightly to ensure VS Code is ready
  setTimeout(() => {
    updateMakefileContext();
  }, 100);
  
  // Clean up running processes on deactivation
  context.subscriptions.push({
    dispose: () => {
      runningProcesses.forEach((process, name) => {
        try {
          process.kill("SIGTERM");
        } catch (error) {
          console.error(`Failed to kill process ${name}:`, error);
        }
      });
      runningProcesses.clear();
    }
  });
}

class MakefileTreeProvider implements vscode.TreeDataProvider<MakeTarget> {
  private _onDidChangeTreeData: vscode.EventEmitter<MakeTarget | undefined> =
    new vscode.EventEmitter<MakeTarget | undefined>();
  readonly onDidChangeTreeData: vscode.Event<MakeTarget | undefined> =
    this._onDidChangeTreeData.event;

  private targets: Array<{ name: string; line: number }> = [];
  private targetObjects: Map<string, MakeTarget> = new Map();

  refresh(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const makefilePath = path.join(workspaceFolders[0].uri.fsPath, "Makefile");
    if (fs.existsSync(makefilePath)) {
      const content = fs.readFileSync(makefilePath, "utf-8");
      this.targets = this.extractTargets(content);
    } else {
      this.targets = [];
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MakeTarget): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<MakeTarget[]> {
    // If no Makefile exists, show a helpful message
    if (this.targets.length === 0) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return Promise.resolve([]);
      }

      const makefilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        "Makefile"
      );
      if (!fs.existsSync(makefilePath)) {
        // Return a placeholder item that shows "No Makefile found"
        const placeholder = new vscode.TreeItem(
          "No Makefile found",
          vscode.TreeItemCollapsibleState.None
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        placeholder.tooltip = "Create a Makefile to see available targets";
        return Promise.resolve([placeholder as any]);
      }
    }

    // Reuse existing target objects to maintain state
    const targetItems = this.targets.map((t) => {
      let targetObj = this.targetObjects.get(t.name);
      if (!targetObj) {
        targetObj = new MakeTarget(t.name, t.line);
        this.targetObjects.set(t.name, targetObj);
      }
      return targetObj;
    });

    return Promise.resolve(targetItems);
  }

  private extractTargets(
    content: string
  ): Array<{ name: string; line: number }> {
    const lines = content.split("\n");
    const targets: Array<{ name: string; line: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([a-zA-Z0-9\-_]+):/);
      if (match) {
        targets.push({ name: match[1], line: i });
      }
    }

    return targets.filter(
      (target, index, self) =>
        index === self.findIndex((t) => t.name === target.name)
    );
  }
}

class MakeTarget extends vscode.TreeItem {
  private isRunning: boolean = false;

  constructor(
    public readonly label: string,
    public readonly lineNumber: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    // Set command to open the target in Makefile when clicked
    this.command = {
      command: "makefileRunner.openTarget",
      title: "Open in Makefile",
      arguments: [this],
    };

    this.updateIcon();

    // Optional: Set tooltip
    this.tooltip = `Click to open in Makefile, or use play button to run make ${label}`;
  }

  setRunning(running: boolean) {
    this.isRunning = running;
    this.updateIcon();
    this.updateContextValue();
  }

  private updateIcon() {
    if (this.isRunning) {
      // Use sync icon with color for running state
      this.iconPath = new vscode.ThemeIcon(
        "sync~spin",
        new vscode.ThemeColor("charts.blue")
      );
    } else {
      // Use tools icon for idle state
      this.iconPath = new vscode.ThemeIcon("tools");
    }
  }

  private updateContextValue() {
    // IMPORTANT: Set contextValue to enable inline actions
    this.contextValue = this.isRunning ? "makeTargetRunning" : "makeTarget";
  }
}

export function deactivate() {}
