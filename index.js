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
          title: $(el).find(".episodiotitle a").text().trim(),
          link: $(el).find(".episodiotitle a").attr("href")
        });
      });
      return res.json({ status: true, data: { episodes } });
    }

    // ---------------- 3. DOWNLOAD (QUALITY දෙකම ගන්න විදිහ) ----------------
    if (action === "download") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      // පියවර 1: එපිසෝඩ් පේජ් එකට ගිහින් එතන තියෙන ඔක්කොම '/links/' URL ටික ගන්නවා
      const { data: epHtml } = await axios.get(url, { headers });
      const $ep = cheerio.load(epHtml);
      const linkPages = [];

      // ටේබල් එක ඇතුළේ තියෙන හැම ඩවුන්ලෝඩ් රෝ එකක්ම පරීක්ෂා කරනවා
      $ep(".downloads_table tr, .links_table tr").each((i, el) => {
          const rowLink = $ep(el).find("a[href*='/links/']").attr("href");
          const quality = $ep(el).find(".quality, td:nth-child(2)").text().trim() || "Download";
          
          if (rowLink) {
              linkPages.push({ quality, rowLink });
          }
      });

      // පියවර 2: හැම ලින්ක් පේජ් එකකටම ගිහින් Google Drive ලින්ක් එක අරගන්නවා
      const final_links = [];

      for (const item of linkPages) {
          try {
              const { data: linkHtml } = await axios.get(item.rowLink, { headers });
              const gdriveRegex = /https:\/\/drive\.google\.com\/[a-zA-Z0-9?%=\-_/.]+/g;
              const matches = linkHtml.match(gdriveRegex) || [];

              matches.forEach(link => {
                  const fileIdMatch = link.match(/[-\w]{25,}/);
                  if (fileIdMatch) {
                      const directLink = `https://drive.usercontent.google.com/download?id=${fileIdMatch[0]}&export=download&authuser=0`;
                      if (!final_links.some(l => l.direct_link === directLink)) {
                          final_links.push({ 
                              quality: item.quality, 
                              direct_link: directLink 
                          });
                      }
                  }
              });
          } catch (e) { continue; }
      }

      return res.json({ status: true, download_links: final_links });
    }

  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
