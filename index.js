import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { action, query, url } = req.query;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    };

    if (!action) return res.status(400).json({ status: false, message: "action missing" });

    // ---------------- 1. ANIME SEARCH ----------------
    if (action === "search") {
      if (!query) return res.status(400).json({ status: false, message: "query missing" });
      
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

    // ---------------- 2. GET EPISODES LIST ----------------
    if (action === "anime") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      const { data } = await axios.get(url, { headers });
      const $ = cheerio.load(data);
      const episodes = [];

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
          image: $(".poster img").attr("src"),
          episodes
        }
      });
    }

    // ---------------- 3. DOWNLOAD LINKS (480p & 720p) ----------------
    if (action === "download") {
      if (!url) return res.status(400).json({ status: false, message: "url missing" });

      const { data: epHtml } = await axios.get(url, { headers });
      const $ep = cheerio.load(epHtml);
      const linkPages = [];

      // පියවර A: පේජ් එකේ තියෙන සියලුම කොලිටි සහ '/links/' URL සොයා ගැනීම
      $ep(".downloads_table tr, .links_table tr").each((i, el) => {
          const rowLink = $ep(el).find("a[href*='/links/']").attr("href");
          let qualityTxt = $ep(el).find(".quality, td:nth-child(2)").first().text().trim();
          
          // Quality එක පිරිසිදු කිරීම
          if (qualityTxt.includes("720p")) qualityTxt = "HD 720p";
          else if (qualityTxt.includes("480p")) qualityTxt = "SD 480p";
          else qualityTxt = "Download";

          if (rowLink) {
              linkPages.push({ quality: qualityTxt, rowLink });
          }
      });

      const final_links = [];

      // පියවර B: හැම ලින්ක් පේජ් එකටම ගොස් ඇත්තම G-Drive ලින්ක් එක ලබාගැනීම
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

      return res.json({ 
        status: true, 
        results: final_links.length,
        download_links: final_links 
      });
    }

  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
