// Add performance mode selector to popup
class ETAInvoiceExporterOptimized extends ETAInvoiceExporter {
  constructor() {
    super();
    this.addPerformanceModeSelector();
  }
  
  addPerformanceModeSelector() {
    const performanceSection = document.createElement('div');
    performanceSection.className = 'section';
    performanceSection.innerHTML = `
      <div class="section-title">وضع الأداء:</div>
      <div class="checkbox-group">
        <div class="checkbox-item">
          <input type="radio" id="mode-auto" name="performance-mode" value="auto" checked>
          <label for="mode-auto">تلقائي (موصى به)</label>
        </div>
        <div class="checkbox-item">
          <input type="radio" id="mode-fast" name="performance-mode" value="fast">
          <label for="mode-fast">سريع جداً (قد يفشل أحياناً)</label>
        </div>
        <div class="checkbox-item">
          <input type="radio" id="mode-balanced" name="performance-mode" value="balanced">
          <label for="mode-balanced">متوازن</label>
        </div>
        <div class="checkbox-item">
          <input type="radio" id="mode-safe" name="performance-mode" value="safe">
          <label for="mode-safe">آمن (بطيء)</label>
        </div>
      </div>
    `;
    
    // Insert before export options
    const exportSection = document.querySelector('.section:last-of-type');
    exportSection.parentNode.insertBefore(performanceSection, exportSection);
    
    // Add event listeners
    document.querySelectorAll('input[name="performance-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.setPerformanceMode(e.target.value);
        }
      });
    });
  }
  
  async setPerformanceMode(mode) {
    try {
      await chrome.runtime.sendMessage({
        action: 'optimizePerformance',
        mode: mode
      });
      
      this.showStatus(`تم تعيين وضع الأداء إلى: ${this.getModeName(mode)}`, 'success');
    } catch (error) {
      console.error('Failed to set performance mode:', error);
    }
  }
  
  getModeName(mode) {
    const names = {
      'auto': 'تلقائي',
      'fast': 'سريع جداً',
      'balanced': 'متوازن',
      'safe': 'آمن'
    };
    return names[mode] || mode;
  }
  
  async exportAllPages(format, options) {
    // Show performance tip
    this.showStatus('نصيحة: استخدم الوضع السريع لتحميل أسرع', 'loading');
    
    // Call parent method
    return await super.exportAllPages(format, options);
  }
}

// Override the original class
document.addEventListener('DOMContentLoaded', () => {
  new ETAInvoiceExporterOptimized();
});