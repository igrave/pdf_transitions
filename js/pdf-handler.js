// PDF Handler
// This file manages PDF loading, rendering, and page management using PDF.js

class PDFHandler {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.rendering = false;
        
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    async loadPDF(file) {
        try {
            const arrayBuffer = await this.fileToArrayBuffer(file);
            
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            
            console.log('PDF loaded successfully');
            console.log('Total pages:', this.totalPages);
            
            return {
                success: true,
                totalPages: this.totalPages
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async renderPage(pageNumber, canvas, scale = null) {
        if (!this.pdfDoc) {
            console.error('No PDF document loaded');
            return null;
        }

        if (this.rendering) {
            console.warn('Already rendering a page');
            return null;
        }

        try {
            this.rendering = true;
            const useScale = scale || this.scale;
            
            // Get the page
            const page = await this.pdfDoc.getPage(pageNumber);
            
            // Get viewport
            const viewport = page.getViewport({ scale: useScale });
            
            // Account for device pixel ratio for high-DPI displays
            const dpr = window.devicePixelRatio || 1;
            
            // Set canvas dimensions (scaled for high-DPI)
            canvas.width = viewport.width * dpr;
            canvas.height = viewport.height * dpr;
            
            // Set display size (CSS pixels)
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';
            
            // Get canvas context and scale for high-DPI
            const context = canvas.getContext('2d');
            context.scale(dpr, dpr);
            
            // Render page
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            this.rendering = false;
            
            console.log(`Page ${pageNumber} rendered at ${dpr}x DPI`);
            
            return {
                success: true,
                width: viewport.width,
                height: viewport.height
            };
        } catch (error) {
            this.rendering = false;
            console.error('Error rendering page:', error);
            return null;
        }
    }

    async getPageAsImageData(pageNumber, scale = null) {
        // Create temporary canvas for rendering
        const tempCanvas = document.createElement('canvas');
        const result = await this.renderPage(pageNumber, tempCanvas, scale);
        
        if (result && result.success) {
            const context = tempCanvas.getContext('2d');
            return context.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        return null;
    }

    async getPageAsTexture(pageNumber, webglUtils, scale = null) {
        // Create temporary canvas for rendering
        const tempCanvas = document.createElement('canvas');
        const result = await this.renderPage(pageNumber, tempCanvas, scale);
        
        if (result && result.success) {
            // Create WebGL texture from canvas
            return webglUtils.createTexture(tempCanvas);
        }
        
        return null;
    }

    getPageCount() {
        return this.totalPages;
    }

    isPDFLoaded() {
        return this.pdfDoc !== null;
    }

    async getPageDimensions(pageNumber) {
        if (!this.pdfDoc) {
            return null;
        }

        try {
            const page = await this.pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: this.scale });
            
            return {
                width: viewport.width,
                height: viewport.height
            };
        } catch (error) {
            console.error('Error getting page dimensions:', error);
            return null;
        }
    }

    setScale(scale) {
        this.scale = scale;
    }

    getScale() {
        return this.scale;
    }
}
