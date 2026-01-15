import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { action, query, url } = req.query;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    };

    if (!action) return res.status(400).json({ status: false, message: "action missing" });

    // 1. සෙවීම (Search)
    if (action === "search") {
      const { data } = await axios.get(`https://animeclub2.com/?s=${encodeURIComponent(query)}`, { headers });
      const $ = cheerio.load(data);
      const results = [];
      $("article").each((i, el) => {
        results.push({
          title: $(el).find(".title").text().trim(),
          link: $(el).find("a").attr("href"),
          image: $(el).find("img").attr("src"),
          type: $(el).find(".sh_type").text().trim() || "Anime"
        });
      });
      return res.json({ status: true, data: results });
    }

    // 2. විස්තර ගැනීම (Details - Movies & TV Shows)
    if (action === "details" || action === "anime") {
      const { data } = await axios.get(url, { headers });
      const $ = cheerio.load(data);
      const episodes = [];

      // එපිසෝඩ් තියෙනවා නම් (TV Show) ඒවා ලිස්ට් එකට එකතු කරයි
      $(".episodios li").each((i, el) => {
        episodes.push({
          ep_num: $(el).find(".numerando").text().trim(),
          title: $(el).find(".episodiotitle a").text().trim(),
          link: $(el).find(".episodiotitle a").attr("href")
        });
      });

      return res.json({
        status: true,
        data: {
          title: $(".data h1").text().trim(),
          image: $(".poster img").attr("src"),
          is_tv_show: episodes.length > 0,
          episodes: episodes.length > 0 ? episodes : null
        }
      });
    }

    // 3. ඩවුන්ලෝඩ් (Download - 480p, 720p, 1080p)
    if (action === "download") {
      const { data: pageHtml } = await axios.get(url, { headers });
      const $page = cheerio.load(pageHtml);
      const linkPages = [];

      // පේජ් එකේ තියෙන සියලුම Download ලින්ක්ස් (Direct & Table) පරීක්ෂා කිරීම
      $page("a[href*='/links/']").each((i, el) => {
          const rowLink = $page(el).attr("href");
          let qTxt = $page(el).closest("tr").find("td").text().trim() || $page(el).text().trim();
          
          if (qTxt.includes("1080p")) qTxt = "Full HD 1080p";
          else if (qTxt.includes("720p")) qTxt = "HD 720p";
          else if (qTxt.includes("480p")) qTxt = "SD 480p";
          else qTxt = "Download";

          if (rowLink && !linkPages.some(p => p.rowLink === rowLink)) {
              linkPages.push({ quality: qTxt, rowLink });
          }
      });

      const final_links = [];

      for (const item of linkPages) {
          try {
              const { data: linkHtml } = await axios.get(item.rowLink, { headers });
              const driveMatch = linkHtml.match(/https:\/\/drive\.google\.com\/[a-zA-Z0-9?%=\-_/.]+/);
              
              if (driveMatch) {
                  const fileId = driveMatch[0].match(/[-\w]{25,}/);
                  if (fileId) {
                      // G-Drive ලින්ක් එක කෙලින්ම ඩවුන්ලෝඩ් වෙන විදිහට සකස් කිරීම
                      const directLink = `https://drive.usercontent.google.com/download?id=${fileId[0]}&export=download&authuser=0`;
                      if (!final_links.some(l => l.direct_link === directLink)) {
                          final_links.push({ quality: item.quality, direct_link: directLink });
                      }
                  }
              }
          } catch (e) { continue; }
      }

      return res.json({ status: true, results: final_links.length, download_links: final_links });
    }

  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
