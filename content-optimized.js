// Optimized Content script for ETA Invoice Exporter - Fast Multi-Page Loading
class ETAContentScriptOptimized {
  constructor() {
    this.invoiceData = [];
    this.allPagesData = [];
    this.totalCount = 0;
    this.currentPage = 1;
    this.totalPages = 1;
    this.resultsPerPage = 50;
    this.isProcessingAllPages = false;
    this.progressCallback = null;
    this.apiEndpoint = null;
    this.authHeaders = null;
    this.init();
  }
  
  init() {
    console.log('ETA Exporter Optimized: Content script initialized');
    this.detectAPIEndpoint();
    this.setupNetworkInterception();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.scanForInvoices());
    } else {
      setTimeout(() => this.scanForInvoices(), 1000);
    }
  }
  
  // Method 1: Direct API Calls (Fastest)
  detectAPIEndpoint() {
    // Intercept network requests to find the API endpoint
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest.prototype.open;
    
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(this, args);
      this.analyzeRequest(args[0], args[1]);
      return response;
    };
    
    window.XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this.addEventListener('load', () => {
        if (this.responseURL && this.responseURL.includes('invoicing.eta.gov.eg')) {
          this.analyzeRequest(url, { method });
        }
      });
      return originalXHR.call(this, method, url, ...args);
    };
  }
  
  analyzeRequest(url, options) {
    if (typeof url === 'string' && url.includes('/api/') && url.includes('documents')) {
      this.apiEndpoint = url;
      console.log('ETA API Endpoint detected:', url);
      
      // Extract auth headers from current requests
      this.extractAuthHeaders();
    }
  }
  
  extractAuthHeaders() {
    // Get auth token from localStorage or sessionStorage
    const token = localStorage.getItem('authToken') || 
                 sessionStorage.getItem('authToken') ||
                 this.extractTokenFromCookies();
    
    if (token) {
      this.authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
  }
  
  extractTokenFromCookies() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name.includes('token') || name.includes('auth')) {
        return value;
      }
    }
    return null;
  }
  
  // Method 2: Parallel Page Loading
  async getAllPagesDataFast(options = {}) {
    try {
      this.isProcessingAllPages = true;
      this.allPagesData = [];
      
      console.log(`ETA Exporter: Fast loading ALL pages. Total: ${this.totalCount} invoices`);
      
      // Try API method first (fastest)
      if (this.apiEndpoint && this.authHeaders) {
        return await this.getAllPagesViaAPI(options);
      }
      
      // Fallback to optimized DOM method
      return await this.getAllPagesViaOptimizedDOM(options);
      
    } catch (error) {
      console.error('ETA Exporter: Error in fast loading:', error);
      return { 
        success: false, 
        data: this.allPagesData,
        error: error.message 
      };
    } finally {
      this.isProcessingAllPages = false;
    }
  }
  
  async getAllPagesViaAPI(options) {
    const batchSize = 10; // Process multiple pages simultaneously
    const pagePromises = [];
    
    for (let page = 1; page <= this.totalPages; page += batchSize) {
      const batch = [];
      
      for (let i = 0; i < batchSize && (page + i) <= this.totalPages; i++) {
        const currentPage = page + i;
        batch.push(this.fetchPageDataViaAPI(currentPage));
      }
      
      pagePromises.push(Promise.all(batch));
    }
    
    // Process all batches
    const results = await Promise.all(pagePromises);
    
    // Flatten results
    const allData = results.flat().flat();
    
    return {
      success: true,
      data: allData,
      totalProcessed: allData.length,
      expectedTotal: this.totalCount
    };
  }
  
  async fetchPageDataViaAPI(pageNumber) {
    try {
      const url = this.buildAPIUrl(pageNumber);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.authHeaders,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.parseAPIResponse(data, pageNumber);
      
    } catch (error) {
      console.warn(`Failed to fetch page ${pageNumber} via API:`, error);
      return [];
    }
  }
  
  buildAPIUrl(pageNumber) {
    const baseUrl = this.apiEndpoint.split('?')[0];
    const params = new URLSearchParams({
      page: pageNumber,
      pageSize: this.resultsPerPage,
      sortBy: 'dateTimeReceived',
      sortOrder: 'desc'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  parseAPIResponse(data, pageNumber) {
    const invoices = data.items || data.documents || data.data || [];
    
    return invoices.map((item, index) => ({
      serialNumber: ((pageNumber - 1) * this.resultsPerPage) + index + 1,
      pageNumber: pageNumber,
      electronicNumber: item.uuid || item.id || '',
      internalNumber: item.internalId || '',
      documentType: item.documentType || 'فاتورة',
      documentVersion: item.documentTypeVersion || '1.0',
      status: this.parseStatus(item.status),
      issueDate: this.formatDate(item.dateTimeIssued),
      submissionDate: this.formatDate(item.dateTimeReceived),
      totalAmount: this.formatAmount(item.totalAmount),
      invoiceValue: this.formatAmount(item.totalSalesAmount),
      vatAmount: this.formatAmount(item.totalTaxableFees),
      sellerName: item.issuer?.name || '',
      sellerTaxNumber: item.issuer?.id || '',
      buyerName: item.receiver?.name || '',
      buyerTaxNumber: item.receiver?.id || '',
      invoiceCurrency: 'EGP',
      taxDiscount: '0',
      electronicSignature: 'موقع إلكترونياً',
      externalLink: this.generateExternalLink(item)
    }));
  }
  
  // Method 3: Optimized DOM Scraping with Parallel Processing
  async getAllPagesViaOptimizedDOM(options) {
    // Pre-calculate all page URLs
    const pageUrls = this.generateAllPageUrls();
    
    // Use iframe-based parallel loading
    return await this.loadPagesInParallel(pageUrls, options);
  }
  
  generateAllPageUrls() {
    const currentUrl = new URL(window.location.href);
    const urls = [];
    
    for (let page = 1; page <= this.totalPages; page++) {
      const url = new URL(currentUrl);
      url.searchParams.set('page', page);
      urls.push(url.toString());
    }
    
    return urls;
  }
  
  async loadPagesInParallel(urls, options) {
    const batchSize = 5; // Load 5 pages simultaneously
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map((url, index) => 
        this.loadPageInIframe(url, i + index + 1)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Update progress
      if (this.progressCallback) {
        this.progressCallback({
          currentPage: Math.min(i + batchSize, urls.length),
          totalPages: urls.length,
          message: `تم تحميل ${Math.min(i + batchSize, urls.length)} من ${urls.length} صفحة`,
          percentage: (Math.min(i + batchSize, urls.length) / urls.length) * 100
        });
      }
    }
    
    return {
      success: true,
      data: results,
      totalProcessed: results.length,
      expectedTotal: this.totalCount
    };
  }
  
  async loadPageInIframe(url, pageNumber) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve([]);
      }, 10000); // 10 second timeout
      
      iframe.onload = () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const data = this.extractDataFromDocument(iframeDoc, pageNumber);
          
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve(data);
        } catch (error) {
          console.warn(`Error loading page ${pageNumber}:`, error);
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve([]);
        }
      };
      
      iframe.onerror = () => {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve([]);
      };
      
      document.body.appendChild(iframe);
    });
  }
  
  extractDataFromDocument(doc, pageNumber) {
    const rows = doc.querySelectorAll('.ms-DetailsRow[role="row"], .ms-List-cell[role="gridcell"]');
    const invoices = [];
    
    rows.forEach((row, index) => {
      const invoice = this.extractDataFromRow(row, index + 1);
      if (this.isValidInvoiceData(invoice)) {
        invoice.pageNumber = pageNumber;
        invoice.serialNumber = ((pageNumber - 1) * this.resultsPerPage) + index + 1;
        invoices.push(invoice);
      }
    });
    
    return invoices;
  }
  
  // Method 4: Bulk Data Export via Browser DevTools Protocol
  async getAllPagesViaBulkExport(options) {
    try {
      // This method uses browser automation capabilities
      const script = `
        (async function() {
          const allData = [];
          const totalPages = ${this.totalPages};
          
          for (let page = 1; page <= totalPages; page++) {
            const response = await fetch('/api/documents?page=' + page + '&pageSize=${this.resultsPerPage}', {
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              allData.push(...(data.items || []));
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          return allData;
        })();
      `;
      
      const result = await eval(script);
      
      return {
        success: true,
        data: this.parseAPIResponse({ items: result }, 1),
        totalProcessed: result.length,
        expectedTotal: this.totalCount
      };
      
    } catch (error) {
      console.error('Bulk export failed:', error);
      throw error;
    }
  }
  
  // Utility methods
  parseStatus(status) {
    const statusMap = {
      'Valid': 'صالح',
      'Invalid': 'غير صالح',
      'Cancelled': 'ملغي',
      'Submitted': 'مقدم',
      'Rejected': 'مرفوض'
    };
    return statusMap[status] || status || '';
  }
  
  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG');
    } catch {
      return dateString;
    }
  }
  
  formatAmount(amount) {
    if (!amount) return '';
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  generateExternalLink(item) {
    if (!item.uuid) return '';
    return `https://invoicing.eta.gov.eg/documents/${item.uuid}/share/${item.uuid.substring(0, 26)}`;
  }
  
  // Keep existing methods for compatibility
  scanForInvoices() {
    // Implementation from original code
    this.extractPaginationInfo();
    const rows = this.getVisibleInvoiceRows();
    
    this.invoiceData = [];
    rows.forEach((row, index) => {
      const invoiceData = this.extractDataFromRow(row, index + 1);
      if (this.isValidInvoiceData(invoiceData)) {
        this.invoiceData.push(invoiceData);
      }
    });
  }
  
  getVisibleInvoiceRows() {
    const selectors = [
      '.ms-DetailsRow[role="row"]',
      '.ms-List-cell[role="gridcell"]',
      '[data-list-index]'
    ];
    
    for (const selector of selectors) {
      const rows = document.querySelectorAll(selector);
      const visibleRows = Array.from(rows).filter(row => 
        this.isRowVisible(row) && this.hasInvoiceData(row)
      );
      
      if (visibleRows.length > 0) {
        return visibleRows;
      }
    }
    
    return [];
  }
  
  isRowVisible(row) {
    if (!row) return false;
    const rect = row.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  
  hasInvoiceData(row) {
    const electronicNumber = row.querySelector('.internalId-link a, [data-automation-key="uuid"] a');
    return !!(electronicNumber?.textContent?.trim());
  }
  
  extractDataFromRow(row, index) {
    // Implementation from original code
    const invoice = {
      index: index,
      serialNumber: index,
      electronicNumber: '',
      internalNumber: '',
      totalAmount: '',
      // ... other fields
    };
    
    this.extractUsingDataAttributes(row, invoice);
    return invoice;
  }
  
  extractUsingDataAttributes(row, invoice) {
    // Implementation from original code
    const cells = row.querySelectorAll('[data-automation-key]');
    
    cells.forEach(cell => {
      const key = cell.getAttribute('data-automation-key');
      
      switch (key) {
        case 'uuid':
          const link = cell.querySelector('a');
          if (link) {
            invoice.electronicNumber = link.textContent?.trim() || '';
          }
          break;
        case 'total':
          const totalElement = cell.querySelector('.griCellTitleGray');
          if (totalElement) {
            invoice.totalAmount = totalElement.textContent?.trim() || '';
          }
          break;
        // ... other cases
      }
    });
  }
  
  extractPaginationInfo() {
    this.totalCount = this.extractTotalCount();
    this.currentPage = this.extractCurrentPage();
    this.resultsPerPage = 50; // Standard page size
    this.totalPages = Math.ceil(this.totalCount / this.resultsPerPage);
  }
  
  extractTotalCount() {
    const resultElements = document.querySelectorAll('*');
    
    for (const element of resultElements) {
      const text = element.textContent || '';
      const resultsMatch = text.match(/Results:\s*(\d+)/i);
      if (resultsMatch) {
        return parseInt(resultsMatch[1]);
      }
    }
    
    return 0;
  }
  
  extractCurrentPage() {
    const activeButton = document.querySelector('[aria-current="page"], .ms-Button--primary[aria-pressed="true"]');
    if (activeButton) {
      const pageNum = parseInt(activeButton.textContent?.trim());
      if (!isNaN(pageNum)) return pageNum;
    }
    return 1;
  }
  
  isValidInvoiceData(invoice) {
    return !!(invoice.electronicNumber || invoice.internalNumber || invoice.totalAmount);
  }
  
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }
  
  getInvoiceData() {
    return {
      invoices: this.invoiceData,
      totalCount: this.totalCount,
      currentPage: this.currentPage,
      totalPages: this.totalPages
    };
  }
  
  // Override the slow method with fast method
  async getAllPagesData(options = {}) {
    return await this.getAllPagesDataFast(options);
  }
}

// Initialize optimized content script
const etaContentScript = new ETAContentScriptOptimized();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('ETA Exporter: Received message:', request.action);
  
  switch (request.action) {
    case 'ping':
      sendResponse({ success: true, message: 'Optimized content script is ready' });
      break;
      
    case 'getInvoiceData':
      const data = etaContentScript.getInvoiceData();
      sendResponse({ success: true, data: data });
      break;
      
    case 'getAllPagesData':
      if (request.options && request.options.progressCallback) {
        etaContentScript.setProgressCallback((progress) => {
          chrome.runtime.sendMessage({
            action: 'progressUpdate',
            progress: progress
          }).catch(() => {});
        });
      }
      
      etaContentScript.getAllPagesData(request.options)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true;
});

console.log('ETA Exporter: Optimized content script loaded successfully');