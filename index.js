import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { action, query, url } = req.query;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    };

    if (!action) return res.status(400).json({ status: false, message: "action missing" });

    // ---------------- 1. ANIME SEARCH (සෙවීම) ----------------
    if (action === "search") {
      const searchUrl = `https://animeclub2.com/?s=${encodeURIComponent(query)}`;
      const { data } = await axios.get(searchUrl, { headers });
      const $ = cheerio.load(data);
      const results = [];

      $("article").each((i, el) => {
        results.push({
          title: $(el).find(".title").text().trim(),
          link: $(el).find("a").attr("href"),
          image: $(el).find("img").attr("src"),
          year: $(el).find(".year").text().trim()
        });
      });
      return res.json({ status: true, data: results });
    }

    // ---------------- 2. GET EPISODES (එපිසෝඩ් ලිස්ට් එක) ----------------
    if (action === "anime") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      const { data } = await axios.get(url, { headers });
      const $ = cheerio.load(data);
      const episodes = [];

      // එපිසෝඩ් ලිස්ට් එක අහුලගමු
      $(".episodios li").each((i, el) => {
        episodes.push({
          ep_num: $(el).find(".numerando").text().trim(),
          title: $(el).find(".episodiotitle a").text().trim(),
          link: $(el).find(".episodiotitle a").attr("href"),
          date: $(el).find(".date").text().trim()
        });
      });

      return res.json({
        status: true,
        data: {
          title: $(".data h1").text().trim(),
          episodes
        }
      });
    }

    // ---------------- 3. GET DOWNLOAD LINK (ඩවුන්ලෝඩ් ලින්ක්) ----------------
    if (action === "download") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      const { data: htmlSource } = await axios.get(url, { headers });
      
      // Google Drive ලින්ක් එකක් පේජ් එකේ කොහේ තිබුණත් අහුලගන්න Regex එකක් පාවිච්චි කරමු
      const gdriveRegex = /https:\/\/drive\.google\.com\/[a-zA-Z0-9?%=\-_/.]+/g;
      const matches = htmlSource.match(gdriveRegex) || [];
      const dl_links = [];

      matches.forEach(link => {
        let finalLink = link;
        // Google Drive link එක Direct Download link එකක් බවට පත් කිරීම
        const fileIdMatch = link.match(/[-\w]{25,}/);
        if (fileIdMatch) {
          finalLink = `https://drive.usercontent.google.com/download?id=${fileIdMatch[0]}&export=download&authuser=0`;
        }

        if (!dl_links.some(l => l.direct_link === finalLink)) {
          dl_links.push({
            quality: "HD Download",
            direct_link: finalLink
          });
        }
      });

      return res.json({ status: true, download_links: dl_links });
    }

  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
