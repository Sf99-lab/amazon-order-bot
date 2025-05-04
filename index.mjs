import puppeteer from 'puppeteer';
//import chromium from '@sparticuz/chromium';
import dotenv from 'dotenv';

dotenv.config();

export async function runOrderAutomation(retryCount=0) {
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

        // const browser = await puppeteer.launch({
        //     args: chromium.args,
        //     defaultViewport: chromium.defaultViewport,
        //     executablePath: process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath(),
        //     headless: config.headless,
        // });

        const browser = await puppeteer.launch({
            headless: config.headless,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        await page.goto('https://www.amazon.com/', { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('#nav-link-accountList', { visible: true });
        await page.click('[data-nav-role="signin"]');

        let emailSelector = '#ap_email';
        if (!await page.$(emailSelector)) emailSelector = '#ap_email_login';
        if (!await page.$(emailSelector)) emailSelector = '[type="email"]';

        await page.waitForSelector(emailSelector, { visible: true });
        await page.type(emailSelector, config.amazonLogin);
        await page.click('#continue');

        await page.waitForSelector('#ap_password', { visible: true });
        await page.type('#ap_password', config.amazonPassword);
        await page.click('#signInSubmit');

        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        } catch (e) {
            console.error('Login failed:', e.message);
            //throw new Error('Login failed - likely due to CAPTCHA');
            console.log('Trying to Login once again...');
            await browser.close();
            return runOrderAutomation(retryCount + 1);
        }
        console.log('Login successful');
        await page.goto(config.productUrl, { waitUntil: 'networkidle2' });
        await page.waitForSelector('input[type="submit"][title="Buy Now"]', { visible: true });
        await page.click('input[title="Buy Now"]');

        const iframeElement = await page.waitForSelector('#turbo-checkout-iframe', { visible: true });
        const iframe = await iframeElement.contentFrame();

        if (iframe) {
            const selector = 'input[type="submit"][value="Place your order"]';
            await iframe.waitForSelector(selector, { visible: true });
            console.log('Order is now available and visible.');
            // await iframe.click(selector);
        } else {
            console.error('Failed to make an Order.');
            console.log('Trying to make an order once again...');
            await browser.close();
            return runOrderAutomation(retryCount + 1);
        }

        await browser.close();
        console.log('The Amazon order took place successfully.');
    } catch (error) {
        console.error('Automation error:', error.message);
    }
}
