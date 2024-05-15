# plaoc-upgrade

##运行脚本
 deno run -A ./auto_updates.ts 
 
 
##验证打包
在bundle文件夹里面起一个服务器 python3 -m http.server
在浏览器里输入： dweb://install?url=http://localhost:8000/metadata.json
