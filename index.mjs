import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import { executablePath } from 'puppeteer';

dotenv.config();
// Use puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin());

// List of realistic user agents
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'
];

// Random delay function to mimic human behavior
const randomDelay = async (min = 1000, max = 5000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await setTimeout(delay);
};

export async function runOrderAutomation(retryCount = 0) {
    if (retryCount > 3) {
        console.error('Tried to make an Order on Amazon 3 times but failed. Now Exiting...');
        return;
    }

    try {
        const config = {
            amazonLogin: process.env.AMAZON_LOGIN,
            amazonPassword: process.env.AMAZON_PASSWORD,
            productUrl: process.env.PRODUCT_URL,
            headless: process.env.HEADLESS !== 'false',
        };

        if (!config.amazonLogin || !config.amazonPassword || !config.productUrl) {
            throw new Error('Missing required configuration');
        }

        // Randomly select a user agent
        const selectedUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

        const browser = await puppeteer.launch({
            headless: config.headless,
            defaultViewport: null,
            executablePath: executablePath(),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                `--user-agent=${selectedUserAgent}`
            ],
        });

        const page = await browser.newPage();

        // Set random viewport size
        await page.setViewport({
            width: 800 + Math.floor(Math.random() * 300),
            height: 400 + Math.floor(Math.random() * 300),
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false
        });

        // Enable request interception to block unnecessary resources
        // await page.setRequestInterception(true);
        // page.on('request', (req) => {
        //     const blockedResources = [
        //         'image', 'stylesheet', 'font', 'media', 'images', 'analytics', 'tracker'
        //     ];
        //     if (blockedResources.some(resource => req.resourceType() === resource)) {
        //         req.abort();
        //     } else {
        //         req.continue();
        //     }
        // });

        // Add human-like mouse movements
        await page.evaluateOnNewDocument(() => {
            window.addEventListener('mousemove', (e) => {
                window.mouseX = e.clientX;
                window.mouseY = e.clientY;
            });
        });

        // Navigate to Amazon with randomized timing
        await page.goto('https://www.amazon.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await randomDelay();

        // Try different selectors for login button
        const loginSelectors = [
            '[data-nav-role="signin"]',
            '#nav-link-accountList',
            '[data-nav-ref="nav_ya_signin"]',
            'a[href*="/ap/signin"]'
        ];

        let loginFound = false;
        for (const selector of loginSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 30000 });
                await page.click(selector);
                loginFound = true;
                break;
            } catch (e) {
                continue;
            }
        }

        if (!loginFound) {
            throw new Error('Could not find login button');
        }

        await randomDelay();

        // Handle email input with multiple possible selectors
        const emailSelectors = [
            '#ap_email',
            '#ap_email_login',
            'input[type="email"]',
            'input[name="email"]'
        ];

        let emailFieldFound = false;
        for (const selector of emailSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 30000 });
                await page.type(selector, config.amazonLogin, { delay: 100 + Math.random() * 50 });
                emailFieldFound = true;
                break;
            } catch (e) {
                continue;
            }
        }

        if (!emailFieldFound) {
            throw new Error('Could not find email field');
        }

        await randomDelay();
        await page.click('#continue');
        await randomDelay();

        // Handle password input
        await page.waitForSelector('#ap_password', { visible: true });
        await page.type('#ap_password', config.amazonPassword, { delay: 100 + Math.random() * 50 });
        await randomDelay(1000, 2000);
        await page.click('#signInSubmit');

        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
            // Check for CAPTCHA
            const captchaExists = await page.evaluate(() => {
                return document.querySelector('form[action="/errors/validateCaptcha"]') !== null;
            });

            if (captchaExists) {
                console.log('CAPTCHA detected. Trying alternative approach...');
                await browser.close();
                return runOrderAutomation(retryCount + 1);
            }

            throw new Error('Login failed');
        }

        console.log('Login successful');
        await randomDelay();

        // Navigate to product page
        await page.goto(config.productUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        console.log('Opening product page')
        await randomDelay();

        // Try to find and click Buy Now button
        const buyNowSelectors = [
            'input[type="submit"][title="Buy Now"]',
            '#buy-now-button',
            '#buyNow',
            'input[name="submit.buy-now"]'
        ];

        let buyNowFound = false;
        for (const selector of buyNowSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 30000 });
                await page.click(selector);
                buyNowFound = true;
                break;
            } catch (e) {
                continue;
            }
        }

        if (!buyNowFound) {
            throw new Error('Could not find Buy Now button');
        }

        await randomDelay();

        // Handle checkout iframe
        const iframeElement = await page.waitForSelector('#turbo-checkout-iframe', {
            visible: true,
            timeout: 40000
        });
        const iframe = await iframeElement.contentFrame();


        if (iframe) {
            const placeOrderSelectors = [
                'input[type="submit"][value="Place your order"]',
                '#placeYourOrder',
                '#submitOrderButtonId'
            ];

            let orderButtonFound = false;
            for (const selector of placeOrderSelectors) {
                try {
                    await iframe.waitForSelector(selector, { timeout: 40000 });
                    console.log('Order is now available and visible.');
                    //await iframe.click(selector); //Final click to place an order
                    orderButtonFound = true;
                    break;
                } catch (e) {
                    console.error(`Error finding Place Order button: ${e.message}`);
                    continue;
                }
            }

            if (!orderButtonFound) {
                console.log('Could not find Place Order button');
            }
        } else { //incase if no iframe is found
            const placeOrderSelectors = [
                'input[type="submit"][value="Place your order"]',
                '#placeYourOrder',
                '#submitOrderButtonId'
            ];

            let orderButtonFound = false;
            for (const selector of placeOrderSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 40000 });
                    console.log('Order is now available and visible.');
                    //await page.click(selector); //Final click to place an order
                    orderButtonFound = true;
                    break;
                } catch (e) {
                    continue;
                }
            }
            if (!orderButtonFound) {
                console.log('Failed to place order');
            }
        }


        await randomDelay(50000, 60000);
        await browser.close();
        console.log('The Amazon order took place successfully.');
    } catch (error) {
        console.error('Automation error:', error.message);
        console.log('Trying again...');
        await browser.close();
        await runOrderAutomation(retryCount + 1);
    }
}