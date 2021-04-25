const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const rm = require("rimraf");
const PDFMerger = require("pdf-merger-js");

// 简单配置
const config = {
    //
    targetUrl: "https://es6.ruanyifeng.com/#docs/destructuring",
    //selector 包含所有的跳转的a标签
    selector: "#sidebar ol li a",
    // 输出路径   末尾斜杠不能丢
    outputPath: "阮一峰ES6/",
    //合并文档输出的名称
    mergeName: "阮一峰es6教程.pdf",
    // 隐藏元素列表,第一个为waitForSelector选择器
    hideElementArr: ["#disqus_thread", "#flip", "#sidebar"],
    // 生成pdf时的页边距
    margin: {
        top: "30px",
        right: "30px",
        bottom: "30px",
        left: "30px",
    },
    // 生成pdf时是否显示页眉页脚
    displayHeaderFooter: false,
    // 生成pdf页面格式
    format: "A4",
};

function resolve(dir, dir2 = "") {
    return path.posix.join(__dirname, "./", dir, dir2);
}

function $(selector, node) {
    return (node || document).querySelector(selector);
}

/**
 * @desc 获取元素 集合 - 暂未使用
 */
function $$(selector, node) {
    return (node || document).querySelectorAll(selector);
}

(async () => {
    const browser = await puppeteer.launch({});
    let page = await browser.newPage();

    //页眉的page
    const license = `
         <p>
         <p>
     `;

    const outputPath = resolve(config.outputPath);

    const isExists = fs.existsSync(outputPath);

    console.log("isExists", isExists, "outputPath", outputPath);

    /**
     * @desc 创建输出路径
     */
    function mkdirOutputpath() {
        try {
            fs.mkdirSync(outputPath);
            console.log("mkdir is successful!");
        } catch (e) {
            console.log("mkdir is failed!", e);
        }
    }
    // 如果不存在 则创建
    if (!isExists) {
        mkdirOutputpath();
    } else {
        // 存在，则删除该目录下的文件重新生成PDF 简单处理
        rm(outputPath, (err) => {
            if (err) throw err;
            console.log("remove the files is successful!");
            mkdirOutputpath();
        });
    }
    await page.goto(config.targetUrl);
    await page.waitForSelector(config.selector);
    let aLinkArr = await page.evaluate((config) => {
        let aLinks = [...document.querySelectorAll(config.selector)];
        return aLinks.map((a) => {
            return {
                href: a.href.trim(),
                text: a.innerText.replace(/\/|\s/g, "-").trim(),
            };
        });
    }, config);

    console.log("aLinkArr.length", aLinkArr.length);

    for (let i = 0; i < aLinkArr.length; i++) {
        let a = aLinkArr[i];
        let aPrev = aLinkArr[i - 1] || {};
        let aNext = aLinkArr[i + 1] || {};

        await page.goto(a.href);

        await page.waitForSelector(config.hideElementArr[0], { timeout: 5000 });

        console.log("go to ", a.href);

        let wh = await page.evaluate(
            (i, a, aLinkArr, aPrev, aNext, license, config) => {
                document.body.style.webkitPrintColorAdjust = "exact";
                // 隐藏元素，不在打印的pdf中展示,比如隐藏评论
                config.hideElementArr.forEach((item) => {
                    let leftNavNode = document.querySelector(item);
                    if (leftNavNode) {
                        leftNavNode.style.display = "none";
                    }
                });

                return {
                    width: 1920,
                    height: document.body.clientHeight,
                };
            },
            i,
            a,
            aLinkArr,
            aPrev,
            aNext,
            license,
            config
        );

        await page.setViewport(wh);

        await page.on("load");

        console.log(`Now, creating the ${a.text}.pdf`);
        try {
            await page.pdf({
                path: resolve(config.outputPath, `${i}-${a.text}.pdf`),
                margin: config.margin,
                displayHeaderFooter: config.displayHeaderFooter,
                format: config.format,
            });
        } catch (e) {}
    }

    console.log("all is successful!");

    browser.close();

    //合并pdf
    var merger = new PDFMerger();
    const filenameArrRe = fs.readdirSync(config.outputPath);
    const filenameArr = filenameArrRe.map(
        (item) => __dirname + "/" + config.outputPath + item
    );
    console.log(filenameArr);
    const sortedFilenameArr = filenameArr.sort((str1, str2) => {
        let regex = /(\d{1,2})-/;
        let a = +str1.match(regex)[1];
        let b = +str2.match(regex)[1];
        return a - b;
    });

    sortedFilenameArr.forEach((item) => {
        merger.add(item);
    });
    await merger.save(__dirname + "/" + config.outputPath + config.mergeName); //save under given name and reset the internal document
    console.log("merge success!!!");
})();
