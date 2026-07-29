import { spawn } from "node:child_process";

export function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  if (platform === "darwin") {
    return runDetached("open", [url]);
  }
  if (platform === "win32") {
    return runDetached("cmd", ["/c", "start", "", url]);
  }
  return runDetached("xdg-open", [url]);
}

function runDetached(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
    });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}
