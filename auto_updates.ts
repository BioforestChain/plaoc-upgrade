import axios from "npm:axios";
import fs from "node:fs";
import unzipper from "npm:unzipper";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
// import { isWindows } from "https://deno.land/std@0.178.0/os/mod.ts";
"node:path"
const appInfos: any[] = [];

async function fetchZipToBundle() {
  for (const info of appInfos) {
    if (!info) continue;
    const dwebAppBase =
      "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps";
    const zipUrl = path.join(
      dwebAppBase,
      info.appName,
      info.version,
      info.zipFullName,
    );
    const srcPath = info.appPath;
    try {
      await downloadOriginZip(zipUrl, srcPath, srcPath);
      await buildBundle(info, path.join(srcPath, "usr/www"), info.bundlePath);
    } catch (error) {
      console.error(`Error in fetchZipToBundle: ${error}`);
    }
  }
}

async function downloadOriginZip(
  fileUrl: string,
  srcPath: string,
  desPath: string,
): Promise<void> {
  const { headers } = await axios.head(fileUrl);
  const totalLength = headers["content-length"];
  const normalizedSrcPath = path.normalize(srcPath);
  const appPath = normalizedSrcPath.split(path.sep)[1];
  const appName = appPath.split("-")[0]; // .filter(part => part.includes('apps') && part.includes('-'))[0].split('-')[0];

  console.log("\n-----------开始处理---" + appName + "-----------");
  const writer = fs.createWriteStream(path.join(srcPath, "file.zip"));
  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
  });

  let downloadedLength = 0;
  response.data.on("data", (chunk: any) => {
    downloadedLength += chunk.length;
    const percentage = (downloadedLength / parseInt(totalLength)) * 100; // Calculate the percentage downloaded
    process.stdout.write(`Downloading... ${percentage.toFixed(2)}%\r`); // Print the percentage in the same line.
  });

  // Pipe the response stream to the file write stream
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      fs.createReadStream(path.join(srcPath, "file.zip"))
        .pipe(unzipper.Extract({ path: desPath }))
        .on("close", () => {
          console.log("\n解压成功.");
          resolve();
        });
    });
    writer.on("error", reject);
  });
}

async function buildBundle(info: any, resourcePath: string, outputPath: string) {
    console.log("开始打包");

    const command = "plaoc";

    let params = [
        "bundle",
        resourcePath,
        "--id",
        info.appId,
        "--version",
        info.version,
        "--out",
        outputPath
    ];

    const cmd = [command, ...params];
    const cmdStr = cmd.join(' ');

    let runCmd;

    // Deno.build.os 会根据操作系统类型返回 ‘windows’ 'darwin' 或 'linux'
    if (Deno.build.os === 'windows') {
        runCmd = ['cmd.exe', '/c', cmdStr];
    } else {
        runCmd = cmd;
    }

    const p = Deno.run({
        cmd: runCmd,
        stdout: "piped",
        stderr: "piped"
    });

    const { code } = await p.status();

    if (code === 0) {
        const rawOutput = await p.output();
        await Deno.stdout.write(rawOutput);
    } else {
        const rawError = await p.stderrOutput();
        const errorString = new TextDecoder().decode(rawError);
        console.log(errorString);
    }
}

async function fecthAppInfo(
  appInfo: { appName: string; version: string; configLink: string },
) {
  const response = await fetch(appInfo.configLink);

  const infoJson = await response.json();
  const bundle_url = infoJson["bundle_url"];
  const appId = infoJson["id"];
  const zipFullName = bundle_url.split("./")[1];
  const zipName = zipFullName.split(".zip")[0];

  const appConfigs = {
    "appId": appId,
    "appName": appInfo.appName,
    "version": appInfo.version,
    "zipName": zipName,
    "zipFullName": zipFullName,
  };

  await creatAppDirs(appConfigs, infoJson);
  return appConfigs;
}

async function fetchApplist() {
  const appListUrl =
    "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/applist.json";
  const baseUrl =
    "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps";
  const response = await fetch(appListUrl);

  const jsonData = await response.json();
  const applist = jsonData["applist"];
  const list = Object.keys(applist).map((key) => {
    return {
      "appName": key,
      "version": applist[key].latest,
      "configLink": `${baseUrl}/${key}/${applist[key].latest}/metadata.json`,
    };
  });
  console.log('获取最新app列表')
  return list;
}

async function creatAppDirs(appInfo: any, metadata: any) {
  const appsRoot = "./apps";
  if (!fs.existsSync(appsRoot)) {
    fs.mkdirSync(appsRoot, { recursive: true });
  }

  const appPath = path.join(appsRoot, appInfo.appName + "-" + appInfo.version);
  if (!fs.existsSync(appPath)) {
    fs.mkdirSync(appPath, { recursive: true });
  }
  const bundlePath = path.join(appPath, appInfo.version);
  if (!fs.existsSync(bundlePath)) {
    fs.mkdirSync(bundlePath, { recursive: true });
  }

  await fs.writeFile(
    appPath + "/metadata.json",
    JSON.stringify(metadata),
    "utf-8",
    (err) => {
      if (err) {
        console.error(err);
      }
    },
  );

  appInfo["appPath"] = appPath;
  appInfo["bundlePath"] = bundlePath;
}
//读取网络app配置，并创建对应目录
async function buildConfig() {
  const applist = await fetchApplist();
  for (const index in applist) {
    // let app = applist[0];
    const app = applist[index];
    const appInfo = await fecthAppInfo(app);
    appInfos.push(appInfo);
  }
  console.log('已更新所有app信息')
}

await buildConfig();
await fetchZipToBundle();


