import axios from "npm:axios";
import fs from "node:fs";
import unzipper from "npm:unzipper";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import process from "node:process";

async function fetchAndbundle() {
  // for (let info of appInfos) {
    let info = appInfos[0]
    if (!info) return;
    // https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/ethmeta/2-1.7.1/eth-metaverse.com.dweb-1.7.1.zip
    let zipUrl =
      "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/" +
      info.appName + "/" + info.version + "/" + info.zipFullName;
    let srcPath = info.appPath;
    let desPath = info.appPath;

    await downloadAndExtractFile(zipUrl, srcPath, desPath);
    await bundle(info, srcPath + '/usr/www', './../' + srcPath)
  // }
}

async function downloadAndExtractFile(
  fileUrl: string,
  srcPath: string,
  desPath: string,
): Promise<void> {
  // Send a HEAD request to get the total file size
  console.log("zipUrl: " + fileUrl);
  const { headers } = await axios.head(fileUrl);
  const totalLength = headers["content-length"];

  console.log(`Total size of the zip to download: ${totalLength} bytes.`);

  const writer = fs.createWriteStream(srcPath + "/file.zip");
  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream",
  });

  let downloadedLength = 0;
  response.data.on("data", (chunk: any) => {
    downloadedLength += chunk.length;
    const percentage = (downloadedLength / parseInt(totalLength)) * 100; // Calculate the percentage downloaded
    // console.log(`Downloading... ${percentage.toFixed(2)}%\r`);
    process.stdout.write(`Downloading... ${percentage.toFixed(2)}%\r`); // Print the percentage in the same line.
  });

  // Pipe the response stream to the file write stream
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      console.log("\nDownload completed. Extracting the file...");
      // Create a read stream and extract the file with unzipper
      fs.createReadStream(srcPath + "/file.zip")
        .pipe(unzipper.Extract({ path: desPath }))
        .on("close", () => {
          console.log("File extracted successfully.");
          resolve();
        });
    });
    writer.on("error", reject);
  });
}


async function bundle(info: any, resourcePath: string, outputPath: string) {
  const command = "plaoc";
  const params = [
    "bundle",
    resourcePath,
    "--id",
    info.appId,
    "--version",
    info.version,
    "--out",
    outputPath,
  ];

  const process = spawn(command, params);

  process.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });

  process.on("close", (code) => {
    console.log(`子进程退出，退出码 ${code}`);
  });
}

function createDirs() {
  // let appConfigs = appInfos;
  let appsRoot = "./apps";
  if (!fs.existsSync(appsRoot)) {
    fs.mkdirSync(appsRoot, { recursive: true });
  }

  for (let info of appInfos) {
    if (info) {
      let appPath = path.join(appsRoot, info.appName + "-" + info.version);
      if (!fs.existsSync(appPath)) {
        fs.mkdirSync(appPath, { recursive: true });
      }
      info["appPath"] = appPath;      
    }
  }
}
async function fetchJson(url: string) {
  const response = await fetch(url); //'https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/applist.json');
  return await response.json();
}

const metaboxUrl: string =
  "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/metabox/2-1.4.1/metadata.json";

async function fecthAppInfo(
  appInfo: { appName: string; version: string; configLink: string },
) {
  try {
    // 下载 JSON 文件
    //   const response = await fetch('https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/applist.json');
    const response = await fetch(appInfo.configLink);

    const infoJson = await response.json();
    const bundle_url = infoJson["bundle_url"];
    const appId = infoJson["id"];
    const zipFullName = bundle_url.split("./")[1];
    const zipName = zipFullName.split(".zip")[0];

    return {
      "appId": appId,
      "appName": appInfo.appName,
      "version": appInfo.version,
      "zipName": zipName,
      "zipFullName": zipFullName,
    };
  } catch (error) {
    console.error("Error:", error);
  }
}

async function fetchApplist() {
  const appListUrl =
    "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps/applist.json";
  const baseUrl =
    "https://raw.githubusercontent.com/BFChainMeta/awesome-bfmeta/main/src/dweb-apps";

  const jsonData = await fetchJson(appListUrl);
  const applist = jsonData["applist"];
  const lsit = Object.keys(applist).map((key) => {
    return {
      "appName": key,
      "version": applist[key].latest,
      "configLink": `${baseUrl}/${key}/${applist[key].latest}/metadata.json`,
    };
  });

  return lsit;
}

const appInfos: any[] = [];

//读取网络app配置，并创建对应目录
async function buildConfig() {
  const applist = await fetchApplist();
  for (let index in applist) {
    let app = applist[index];
    let appInfo = await fecthAppInfo(app);
    appInfos.push(appInfo);
  }

  createDirs();
}

await buildConfig();
await fetchAndbundle();

