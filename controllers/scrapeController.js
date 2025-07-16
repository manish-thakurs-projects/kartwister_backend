const puppeteer = require('puppeteer');

function detectSite(url) {
  if (/daraz\.com\.np/.test(url)) return 'daraz';
  if (/flipkart\.com/.test(url)) return 'flipkart';
  if (/amazon\.(com|in)/.test(url)) return 'amazon';
  return 'unknown';
}

async function scrapeDaraz(page) {
  await page.waitForSelector('.pdp-mod-product-badge-title');
  const name = await page.$eval('.pdp-mod-product-badge-title', el => el.textContent.trim());
  const price = await page.$eval('.pdp-price_type_normal', el => el.textContent.replace(/[^\d.]/g, ''));
  const image = await page.$eval('.gallery-preview-panel__image', el => el.src);
  return { name, price, image, site: 'Daraz' };
}

async function scrapeFlipkart(page) {
  await page.waitForSelector('span.B_NuCI');
  const name = await page.$eval('span.B_NuCI', el => el.textContent.trim());
  const price = await page.$eval('div._30jeq3._16Jk6d', el => el.textContent.replace(/[^\d.]/g, ''));
  const image = await page.$eval('img._396cs4._2amPTt._3qGmMb', el => el.src);
  return { name, price, image, site: 'Flipkart' };
}

async function scrapeAmazon(page) {
  await page.waitForSelector('#productTitle');
  const name = await page.$eval('#productTitle', el => el.textContent.trim());
  let price = '';
  try {
    price = await page.$eval('.a-price .a-offscreen', el => el.textContent.replace(/[^\d.]/g, ''));
  } catch {
    price = await page.$eval('#priceblock_ourprice', el => el.textContent.replace(/[^\d.]/g, ''));
  }
  let image = '';
  try {
    image = await page.$eval('#landingImage', el => el.src);
  } catch {
    image = await page.$eval('#imgTagWrapperId img', el => el.src);
  }
  return { name, price, image, site: 'Amazon' };
}

exports.scrapeProduct = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'URL is required' });
  const site = detectSite(url);
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let data;
    if (site === 'daraz') data = await scrapeDaraz(page);
    else if (site === 'flipkart') data = await scrapeFlipkart(page);
    else if (site === 'amazon') data = await scrapeAmazon(page);
    else data = { name: '', price: '', image: '', site: 'Unknown', message: 'Site not supported yet' };
    data.url = url;
    // Record scrape request if user is authenticated
    if (req.user && req.user.userId) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.userId, {
        $push: {
          scrapeRequests: {
            url,
            site,
            name: data.name,
            date: new Date()
          }
        }
      });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Scraping failed', error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}; 