import { chromium, Browser, BrowserContext, Page } from "playwright";

class PlaywrightPdfService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log("[PlaywrightPDF] Initializing browser...");
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      console.log("[PlaywrightPDF] Browser initialized");
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("[PlaywrightPDF] Browser closed");
    }
  }

  private async authenticateAndNavigate(page: Page, baseUrl: string, targetUrl: string): Promise<void> {
    console.log("[PlaywrightPDF] Authenticating...");
    
    const reportUser = process.env.REPORT_SERVICE_USER || 'login@sistema.com';
    const reportPass = process.env.REPORT_SERVICE_PASSWORD || 'admin';
    console.log(`[PlaywrightPDF] Using credentials: ${reportUser}`);
    
    await page.goto(`${baseUrl}/`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Check if already logged in (redirected to dashboard)
    const currentUrl = page.url();
    console.log(`[PlaywrightPDF] Current URL after load: ${currentUrl}`);
    
    if (currentUrl.includes('/dashboard')) {
      console.log("[PlaywrightPDF] Already authenticated, skipping login");
    } else {
      // Wait for login form
      try {
        await page.waitForSelector('[data-testid="input-email"]', { timeout: 15000 });
      } catch (e) {
        console.log(`[PlaywrightPDF] Login form not found. Current URL: ${page.url()}`);
        const content = await page.content();
        console.log(`[PlaywrightPDF] Page content preview: ${content.substring(0, 500)}`);
        throw new Error("Login form not found - check if the app is running correctly");
      }
      
      await page.fill('[data-testid="input-email"]', reportUser);
      await page.fill('[data-testid="input-password"]', reportPass);
      
      console.log("[PlaywrightPDF] Submitting login form...");
      await page.click('[data-testid="button-login"]');

      // Wait for either dashboard URL or an error message
      try {
        await Promise.race([
          page.waitForURL('**/dashboard', { timeout: 120000 }),
          page.waitForSelector('[data-testid="error-message"]', { timeout: 120000 }).then(() => {
            throw new Error("Login failed - check credentials");
          })
        ]);
      } catch (e: any) {
        const finalUrl = page.url();
        console.log(`[PlaywrightPDF] Login timeout. Final URL: ${finalUrl}`);
        if (!finalUrl.includes('/dashboard')) {
          const content = await page.content();
          console.log(`[PlaywrightPDF] Page content: ${content.substring(0, 1000)}`);
          throw new Error(`Login failed - stuck at ${finalUrl}`);
        }
      }
      
      console.log("[PlaywrightPDF] Authentication successful");
    }
    
    console.log(`[PlaywrightPDF] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
  }

  async generatePdf(companyId: string, baseUrl: string): Promise<Buffer> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    try {
      const reportUrl = `${baseUrl}/report/print/${companyId}`;
      await this.authenticateAndNavigate(page, baseUrl, reportUrl);

      console.log("[PlaywrightPDF] Waiting for report to be ready...");
      
      const maxWaitTime = 60000;
      const checkInterval = 2000;
      let elapsed = 0;
      let isReady = false;
      
      while (elapsed < maxWaitTime && !isReady) {
        isReady = await page.evaluate(() => (window as any).__REPORT_READY__ === true);
        
        if (!isReady) {
          const hasError = await page.locator('[data-error="true"]').count() > 0;
          if (hasError) {
            throw new Error("Report page shows error - data not available for this client");
          }
          
          const hasSpinner = await page.locator('.animate-spin').count() > 0;
          if (hasSpinner) {
            console.log(`[PlaywrightPDF] Still loading... (${elapsed}ms elapsed)`);
          }
          
          await page.waitForTimeout(checkInterval);
          elapsed += checkInterval;
        }
      }
      
      if (!isReady) {
        const content = await page.content();
        console.log("[PlaywrightPDF] Page content on timeout:", content.substring(0, 500));
        throw new Error("Report failed to load within timeout - check if all API endpoints are responding");
      }
      
      console.log("[PlaywrightPDF] Report ready, waiting for charts to render...");
      await page.waitForTimeout(3000);

      console.log("[PlaywrightPDF] Generating PDF...");
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: {
          top: "10mm",
          bottom: "10mm",
          left: "10mm",
          right: "10mm",
        },
        displayHeaderFooter: false,
      });

      console.log(`[PlaywrightPDF] PDF generated successfully (${pdfBuffer.length} bytes)`);
      return Buffer.from(pdfBuffer);
      
    } catch (error) {
      console.error("[PlaywrightPDF] Error generating PDF:", error);
      throw error;
    } finally {
      await page.close();
      await context.close();
    }
  }

  async generateScreenshot(companyId: string, baseUrl: string): Promise<Buffer> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const reportUrl = `${baseUrl}/report/print/${companyId}`;
      await this.authenticateAndNavigate(page, baseUrl, reportUrl);

      const maxWaitTime = 60000;
      const checkInterval = 2000;
      let elapsed = 0;
      let isReady = false;
      
      while (elapsed < maxWaitTime && !isReady) {
        isReady = await page.evaluate(() => (window as any).__REPORT_READY__ === true);
        if (!isReady) {
          await page.waitForTimeout(checkInterval);
          elapsed += checkInterval;
        }
      }
      
      await page.waitForTimeout(3000);

      console.log("[PlaywrightPDF] Taking screenshot...");
      const screenshot = await page.screenshot({
        fullPage: true,
        type: "png",
      });

      console.log(`[PlaywrightPDF] Screenshot taken (${screenshot.length} bytes)`);
      return Buffer.from(screenshot);
      
    } catch (error) {
      console.error("[PlaywrightPDF] Error taking screenshot:", error);
      throw error;
    } finally {
      await page.close();
      await context.close();
    }
  }
}

export const playwrightPdfService = new PlaywrightPdfService();
