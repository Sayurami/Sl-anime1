import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { action, query, url } = req.query;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    };

    if (!action) return res.status(400).json({ status: false, message: "action missing" });

    // ---------------- 1. SEARCH ----------------
    if (action === "search") {
      const searchUrl = `https://animeclub2.com/?s=${encodeURIComponent(query)}`;
      const { data } = await axios.get(searchUrl, { headers });
      const $ = cheerio.load(data);
      const results = [];
      $("article").each((i, el) => {
        results.push({
          title: $(el).find(".title").text().trim(),
          link: $(el).find("a").attr("href"),
          image: $(el).find("img").attr("src")
        });
      });
      return res.json({ status: true, data: results });
    }

    // ---------------- 2. GET EPISODES ----------------
    if (action === "anime") {
      const { data } = await axios.get(url, { headers });
      const $ = cheerio.load(data);
      const episodes = [];
      $(".episodios li").each((i, el) => {
        episodes.push({
          ep_num: $(el).find(".numerando").text().trim(),
          link: $(el).find(".episodiotitle a").attr("href")
        });
      });
      return res.json({ status: true, data: { episodes } });
    }

    // ---------------- 3. DOWNLOAD (MULTI-STEP SCAN) ----------------
    if (action === "download") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      // පියවර A: එපිසෝඩ් පේජ් එකට ගොස් '/links/' URL එක සොයා ගැනීම
      const { data: epHtml } = await axios.get(url, { headers });
      const $ep = cheerio.load(epHtml);
      let redirectLink = "";

      $ep("a").each((i, el) => {
        const href = $ep(el).attr("href") || "";
        if (href.includes("/links/")) {
          redirectLink = href;
        }
      });

      // පියවර B: '/links/' පේජ් එක ඇතුළට ගොස් Google Drive ලින්ක් එක ඇද ගැනීම
      if (redirectLink) {
        const { data: linkHtml } = await axios.get(redirectLink, { headers });
        const gdriveRegex = /https:\/\/drive\.google\.com\/[a-zA-Z0-9?%=\-_/.]+/g;
        const matches = linkHtml.match(gdriveRegex) || [];
        const dl_links = [];

        matches.forEach(link => {
          const fileIdMatch = link.match(/[-\w]{25,}/);
          if (fileIdMatch) {
            const finalLink = `https://drive.usercontent.google.com/download?id=${fileIdMatch[0]}&export=download&authuser=0`;
            if (!dl_links.some(l => l.direct_link === finalLink)) {
              dl_links.push({ quality: "HD Download", direct_link: finalLink });
            }
          }
        });

        return res.json({ status: true, download_links: dl_links });
      }

      return res.json({ status: false, message: "No download links found" });
    }

  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
