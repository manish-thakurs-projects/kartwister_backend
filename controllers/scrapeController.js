const puppeteer = require('puppeteer');

function detectSite(url) {
  // Handle Amazon app links (amzn.in)
  if (/amzn\.in/.test(url)) {
    return 'amazon';
  }
  
  // Handle Flipkart app links (dl.flipkart.com)
  if (/dl\.flipkart\.com/.test(url)) {
    return 'flipkart';
  }
  
  // Handle other Amazon domains
  if (/amazon\.(com|in|co\.uk|de|fr|it|es|ca|com\.au|co\.jp)/.test(url)) {
    return 'amazon';
  }
  
  // Handle Flipkart
  if (/flipkart\.com/.test(url)) {
    return 'flipkart';
  }
  
  return 'unknown';
}

// Function to normalize Amazon URLs
async function normalizeAmazonUrl(page, url) {
  // If it's an Amazon app link, we need to follow the redirect
  if (/amzn\.in/.test(url)) {
    try {
      console.log('Processing Amazon app link:', url);
      
      // Navigate to the app link first
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Get the final URL after redirect
      const finalUrl = page.url();
      console.log(`Amazon app link redirected to: ${finalUrl}`);
      
      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If it's still an app link, try to find product info or continue button
      if (/amzn\.in/.test(finalUrl)) {
        try {
          // Try to find product information directly
          await page.waitForSelector('#productTitle, .a-size-large', { timeout: 5000 });
          console.log('Found product info on app link page');
          return finalUrl;
        } catch (e) {
          console.log('No product info found, looking for continue button...');
          // Try to click any "Continue to Amazon" or similar buttons
          try {
            const continueButton = await page.$('a[href*="amazon"], button[onclick*="amazon"], .continue-button');
            if (continueButton) {
              console.log('Found continue button, clicking...');
              await continueButton.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              const newUrl = page.url();
              console.log('After clicking continue button:', newUrl);
              return newUrl;
            }
          } catch (clickError) {
            console.log('Could not click continue button:', clickError.message);
          }
        }
      }
      
      return finalUrl;
    } catch (error) {
      console.log('Error normalizing Amazon app link:', error.message);
      return url; // Return original URL if normalization fails
    }
  }
  
  return url;
}

// Function to normalize Flipkart URLs
async function normalizeFlipkartUrl(page, url) {
  // If it's a Flipkart app link, we need to follow the redirect
  if (/dl\.flipkart\.com/.test(url)) {
    try {
      console.log('Processing Flipkart app link:', url);
      
      // Navigate to the app link first
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Get the final URL after redirect
      const finalUrl = page.url();
      console.log(`Flipkart app link redirected to: ${finalUrl}`);
      
      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If it's still an app link, try to find product info or continue button
      if (/dl\.flipkart\.com/.test(finalUrl)) {
        try {
          // Try to find product information directly
          await page.waitForSelector('span.B_NuCI, h1._2E8PTH, h1', { timeout: 5000 });
          console.log('Found product info on app link page');
          return finalUrl;
        } catch (e) {
          console.log('No product info found, looking for continue button...');
          // Try to click any "Continue to Flipkart" or similar buttons
          try {
            const continueButton = await page.$('a[href*="flipkart"], button[onclick*="flipkart"], .continue-button');
            if (continueButton) {
              console.log('Found continue button, clicking...');
              await continueButton.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              const newUrl = page.url();
              console.log('After clicking continue button:', newUrl);
              return newUrl;
            }
          } catch (clickError) {
            console.log('Could not click continue button:', clickError.message);
          }
        }
      }
      
      return finalUrl;
    } catch (error) {
      console.log('Error normalizing Flipkart app link:', error.message);
      return url; // Return original URL if normalization fails
    }
  }
  
  return url;
}

async function scrapeFlipkart(page) {
  try {
    console.log('Starting Flipkart scraping...');
    
    // Wait for the page to load completely
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to find product title with multiple selectors
    const titleSelectors = [
      'span.B_NuCI',
      'h1._2E8PTH',
      'h1',
      '.product-title',
      '[data-testid="product-title"]',
      '.title',
      '.product-name',
      'span[class*="title"]',
      'h1[class*="title"]',
      '.product-details h1',
      '.product-info h1',
      'span[class*="product"]',
      'h1[class*="product"]'
    ];
    
    let name = '';
    for (const selector of titleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        name = await page.$eval(selector, el => el.textContent.trim());
        if (name && name.length > 0) {
          console.log('Found product title:', name.substring(0, 50) + '...');
          break;
        }
      } catch (e) {
        console.log(`Title selector ${selector} not found`);
      }
    }
    
    if (!name) {
      throw new Error('Could not find product title');
    }
    
    // Try to find price with the correct selectors from debug
    let price = '';
    const priceSelectors = [
      'div.Nx9bqj.CxhGGd.yKS4la', // Found from debug
      'div[class*="Nx9bqj"]',
      'div[class*="CxhGGd"]',
      'div[class*="yKS4la"]',
      'div._30jeq3._16Jk6d',
      '._30jeq3',
      '._16Jk6d',
      '._1_WHN1',
      'div[class*="_30jeq3"]',
      'span[class*="_30jeq3"]'
    ];
    
    for (const selector of priceSelectors) {
      try {
        const priceElement = await page.$(selector);
        if (priceElement) {
          const priceText = await page.$eval(selector, el => el.textContent.trim());
          if (priceText && priceText.length > 0) {
            // Clean the price text - extract only numbers and decimal points
            const cleanedPrice = priceText.replace(/[^\d,.]/g, '');
            if (cleanedPrice && cleanedPrice.length > 0) {
              price = cleanedPrice;
              console.log('Found price with selector:', price);
              break;
            }
          }
        }
      } catch (e) {
        console.log(`Price selector ${selector} not found`);
      }
    }
    
    // If no price found with specific selectors, try a more targeted approach
    if (!price) {
      try {
        price = await page.evaluate(() => {
          // Look for price elements with specific patterns
          const priceElements = document.querySelectorAll('*');
          for (const element of priceElements) {
            const text = element.textContent.trim();
            // Look for patterns like ₹1,399 or Rs. 1,399 or 1399
            if (text && (
              text.includes('₹') || 
              text.includes('Rs.') || 
              text.includes('INR') ||
              /^\d+([,.]\d+)*$/.test(text.replace(/[^\d,.]/g, ''))
            )) {
              // Extract only numbers and decimal points
              const numbers = text.replace(/[^\d,.]/g, '');
              if (numbers.length >= 3 && numbers.length <= 10) { // Reasonable price length
                return numbers;
              }
            }
          }
          return '';
        });
        
        if (price) {
          console.log('Found price using targeted search:', price);
        }
      } catch (e) {
        console.log('Targeted price search failed:', e.message);
      }
    }
    
    // Try to find image with the correct selectors from debug
    let image = '';
    const imageSelectors = [
      'img.DByuf4.IZexXJ.jLEJ7H', // Found from debug
      'img[class*="DByuf4"]',
      'img[class*="IZexXJ"]',
      'img[class*="jLEJ7H"]',
      'img._396cs4._2amPTt._3qGmMb',
      'img[class*="_396cs4"]',
      'img[class*="_2amPTt"]',
      'img[class*="_3qGmMb"]',
      '.product-image img',
      '.gallery-image img',
      '[data-testid="product-image"] img'
    ];
    
    for (const selector of imageSelectors) {
      try {
        const imageElement = await page.$(selector);
        if (imageElement) {
          const imageSrc = await page.$eval(selector, el => el.src);
          if (imageSrc && imageSrc.length > 0 && imageSrc.includes('flipkart')) {
            image = imageSrc;
            console.log('Found image with selector');
            break;
          }
        }
      } catch (e) {
        console.log(`Image selector ${selector} not found`);
      }
    }
    
    // If no image found, try a more targeted approach
    if (!image) {
      try {
        image = await page.evaluate(() => {
          // Look for product images specifically
          const allImages = document.querySelectorAll('img');
          for (const img of allImages) {
            const src = img.src;
            const alt = img.alt || '';
            const title = img.title || '';
            
            // Check if it's likely a product image
            if (src && (
              src.includes('flipkart') ||
              src.includes('product') ||
              src.includes('image') ||
              src.includes('gallery') ||
              alt.toLowerCase().includes('product') ||
              title.toLowerCase().includes('product') ||
              alt.toLowerCase().includes('image') ||
              title.toLowerCase().includes('image')
            )) {
              // Make sure it's not a small icon or logo
              if (img.width > 100 && img.height > 100) {
                return src;
              }
            }
          }
          return '';
        });
        
        if (image) {
          console.log('Found image using targeted search');
        }
      } catch (e) {
        console.log('Targeted image search failed:', e.message);
      }
    }
    
    // Final validation and cleaning
    if (price) {
      // Clean up the price - remove any extra characters and ensure it's a reasonable number
      price = price.replace(/[^\d,.]/g, '');
      // If it's too long, it might be concatenated data
      if (price.length > 10) {
        // Try to extract the first reasonable price
        const priceMatch = price.match(/\d{1,3}(,\d{3})*(\.\d{2})?/);
        if (priceMatch) {
          price = priceMatch[0];
        }
      }
    }
    
    console.log('Flipkart scraping completed successfully');
    console.log('Final data:', { name: name.substring(0, 50) + '...', price, image: image ? 'Found' : 'Not found' });
    
    return { name, price, image, site: 'Flipkart' };
  } catch (error) {
    throw new Error(`Failed to scrape Flipkart: ${error.message}`);
  }
}

async function scrapeAmazon(page) {
  try {
    console.log('Starting Amazon scraping...');
    
    // Wait for product title with multiple possible selectors
    const titleSelectors = ['#productTitle', '.a-size-large', '.product-title', '[data-testid="product-title"]'];
    let name = '';
    
    for (const selector of titleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 8000 });
        name = await page.$eval(selector, el => el.textContent.trim());
        console.log('Found product title:', name.substring(0, 50) + '...');
        break;
      } catch (e) {
        console.log(`Selector ${selector} not found`);
      }
    }
    
    if (!name) {
      throw new Error('Could not find product title');
    }
    
    let price = '';
    const priceSelectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '.a-price-whole',
      '.a-price-range .a-offscreen',
      '[data-testid="price"]',
      '.priceToPay .a-offscreen'
    ];
    
    for (const selector of priceSelectors) {
      try {
        price = await page.$eval(selector, el => el.textContent.replace(/[^\d.]/g, ''));
        if (price) {
          console.log('Found price:', price);
          break;
        }
      } catch (e) {
        console.log(`Price selector ${selector} not found`);
      }
    }
    
    let image = '';
    const imageSelectors = [
      '#landingImage',
      '#imgTagWrapperId img',
      '.imageThumb img',
      '.a-dynamic-image',
      '[data-testid="product-image"] img'
    ];
    
    for (const selector of imageSelectors) {
      try {
        image = await page.$eval(selector, el => el.src);
        if (image) {
          console.log('Found image URL');
          break;
        }
      } catch (e) {
        console.log(`Image selector ${selector} not found`);
      }
    }
    
    return { name, price, image, site: 'Amazon' };
  } catch (error) {
    throw new Error(`Failed to scrape Amazon: ${error.message}`);
  }
}

exports.scrapeProduct = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'URL is required' });
  
  console.log('Received scrape request for URL:', url);
  
  const site = detectSite(url);
  console.log('Detected site:', site);
  
  if (site === 'unknown') {
    return res.status(400).json({ message: 'Unsupported website. Please use Amazon or Flipkart URLs.' });
  }
  
  let browser;
  try {
    console.log('Launching browser...');
    
    // Launch browser with additional options for better compatibility
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Handle Amazon app links
    let finalUrl = url;
    if (site === 'amazon') {
      console.log('Processing Amazon URL...');
      finalUrl = await normalizeAmazonUrl(page, url);
      console.log('Final URL after normalization:', finalUrl);
    }

    // Handle Flipkart app links
    if (site === 'flipkart') {
      console.log('Processing Flipkart URL...');
      finalUrl = await normalizeFlipkartUrl(page, url);
      console.log('Final URL after normalization:', finalUrl);
    }
    
    // Navigate to the final URL
    console.log('Navigating to:', finalUrl);
    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let data;
    console.log('Starting scraping for site:', site);
    
    if (site === 'flipkart') {
      data = await scrapeFlipkart(page);
    } else if (site === 'amazon') {
      data = await scrapeAmazon(page);
    }
    
    console.log('Scraping completed successfully');
    
    // Add URL to response
    data.url = finalUrl;
    data.originalUrl = url;
    
    // Record scrape request if user is authenticated
    if (req.user && req.user.userId) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.userId, {
        $push: {
          scrapeRequests: {
            url: finalUrl,
            originalUrl: url,
            site,
            name: data.name,
            date: new Date()
          }
        }
      });
    }
    
    res.json(data);
  } catch (err) {
    console.error('Scraping error:', err);
    res.status(500).json({ 
      message: 'Scraping failed', 
      error: err.message,
      details: 'Please make sure the URL is a valid product page and try again.'
    });
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}; 