const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const marked = require("marked");

const app = express();
const port = 3000;

// CommonJSでは __dirname と __filename は自動的に利用可能
app.set("views", path.join(__dirname, 'views'));
console.log("Express views directory:", app.get("views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public"))); 
const articlesDir = path.join(__dirname, "articles");

app.get("/", async (req, res) => {
    try {
        console.log("GET / called");
        const files = await fs.readdir(articlesDir);
        console.log("files:", files);
        const articleList = [];

        for (const file of files) {
            if (file.endsWith(".md")) {
                const mdPath = path.join(articlesDir, file);
                const mdContent = await fs.readFile(mdPath, "utf-8");
                console.log("mdContent length:", mdContent.length);
                const lines = mdContent.split(/\r?\n/);
                const titleMatch = lines[0].match(/^#\s*(.+)/);
                const title = titleMatch ? titleMatch[1] : file.replace(".md", "");
                const description = lines[1] ? lines[1].trim() : "";
                articleList.push({
                    title: title,
                    slug: file.replace(".md", ""),
                    description: description
                });
            }
        }
        res.render("index", { articles: articleList });
    } catch (err) {
        console.error("記事一覧の読み込みエラー:", err);
        res.status(500).send("記事一覧の読み込み中にエラーが発生しました。");
    }
});

app.get("/article/:slug", async (req, res) => {
    try {
        const filePath = path.join(articlesDir, `${req.params.slug}.md`);
        const md = await fs.readFile(filePath, "utf-8");
        const html = marked.parse(md);
        const titleMatch = md.match(/^#\s(.+)/);
        const title = titleMatch ? titleMatch[1] : req.params.slug;
        res.render("articles", {
            title: title,
            content: html
        });
    } catch (err) {
        console.error("記事読み込みエラー:", err);
        res.status(404).send("記事が見つかりません");
    }
});

app.get("/terms", (req, res) => {
    res.render("terms");
});

app.get("/AHAbot-2", (req, res) => {
    res.render("AHAbot2");
});

app.get("/custom", (req, res) => {
    res.render("custom");
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});