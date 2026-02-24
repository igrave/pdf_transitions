// Main Application Script
// This file orchestrates the PDF viewer and WebGL transitions

class PDFTransitionsApp {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 0;
        this.pdfDocument = null;
        this.currentTransition = 'fade';
        this.pdfHandler = new PDFHandler();
        this.webglUtils = null;
        this.isTransitioning = false;
        this.currentPageCanvas = null;
        this.pageCache = new Map(); // Cache for pre-rendered pages
        this.isPrerendering = false;
        
        this.init();
    }

    init() {
        // Initialize UI elements
        this.initializeElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize WebGL context
        this.initWebGL();
        
        console.log('PDF Transitions App initialized');
    }

    initializeElements() {
        // PDF Upload
        this.pdfUpload = document.getElementById('pdfUpload');
        
        // Navigation
        this.prevButton = document.getElementById('prevPage');
        this.nextButton = document.getElementById('nextPage');
        this.currentPageSpan = document.getElementById('currentPage');
        this.totalPagesSpan = document.getElementById('totalPages');
        
        // Transition selector
        this.transitionSelect = document.getElementById('transitionSelect');
        
        // Fullscreen button
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Canvases
        this.pdfCanvas = document.getElementById('pdfCanvas');
        this.webglCanvas = document.getElementById('webglCanvas');
        
        // Viewer container
        this.viewer = document.querySelector('.viewer');
    }

    setupEventListeners() {
        // PDF upload handler
        this.pdfUpload.addEventListener('change', (e) => {
            this.handlePDFUpload(e);
        });

        // Navigation handlers
        this.prevButton.addEventListener('click', () => {
            this.goToPreviousPage();
        });

        this.nextButton.addEventListener('click', () => {
            this.goToNextPage();
        });

        // Transition selector handler
        this.transitionSelect.addEventListener('change', (e) => {
            this.currentTransition = e.target.value;
            console.log('Transition changed to:', this.currentTransition);
        });

        // Fullscreen button handler
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                this.goToNextPage();
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                this.goToPreviousPage();
            }
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            }
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
        });

        // Update fullscreen button text when fullscreen changes
        const handleFullscreenChange = () => {
            this.updateFullscreenButton();
            // Re-render current page with new scale when fullscreen changes
            if (this.pdfHandler.isPDFLoaded()) {
                setTimeout(() => {
                    this.renderPage();
                }, 100); // Small delay to let the viewer resize
            }
        };
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    initWebGL() {
        // Initialize WebGL utilities
        try {
            this.webglUtils = new WebGLUtils(this.webglCanvas);
            console.log('WebGL initialized successfully');
        } catch (error) {
            console.error('Failed to initialize WebGL:', error);
        }
    }

    handlePDFUpload(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            console.log('PDF file selected:', file.name);
            this.pdfHandler.loadPDF(file).then((result) => {
                if (result.success) {
                    this.totalPages = result.totalPages;
                    this.currentPage = 1;
                    this.updatePageInfo();
                    // Show the PDF canvas
                    this.pdfCanvas.style.display = 'block';
                    this.renderPage();
                } else {
                    console.error('Failed to load PDF:', result.error);
                }
            });
        } else {
            console.error('Please select a valid PDF file');
        }
    }

    goToPreviousPage() {
        if (this.currentPage > 1 && !this.isTransitioning) {
            this.currentPage--;
            this.renderPageWithTransition();
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages && !this.isTransitioning) {
            this.currentPage++;
            this.renderPageWithTransition();
        }
    }

    renderPage() {
        if (!this.pdfHandler.isPDFLoaded()) {
            console.error('No PDF loaded');
            return;
        }
        
        this.updatePageInfo();
        console.log('Rendering page:', this.currentPage);
        
        // Calculate optimal scale to fit viewer
        this.calculateOptimalScale(this.currentPage).then(() => {
            // Render the current page to the PDF canvas
            this.pdfHandler.renderPage(this.currentPage, this.pdfCanvas)
                .then((result) => {
                    if (result && result.success) {
                        console.log('Page rendered successfully');
                        // Store current page canvas for transitions
                        this.currentPageCanvas = this.pdfCanvas;
                        // Pre-render adjacent pages for smooth navigation
                        this.prerenderAdjacentPages();
                    } else {
                        console.error('Failed to render page');
                    }
                })
                .catch((error) => {
                    console.error('Error rendering page:', error);
                });
        });
    }

    async calculateOptimalScale(pageNumber) {
        if (!this.pdfHandler.isPDFLoaded()) {
            return;
        }

        // Get viewer dimensions
        const viewerWidth = this.viewer.clientWidth;
        const viewerHeight = this.viewer.clientHeight;
        
        // Get page dimensions at scale 1.0
        const page = await this.pdfHandler.pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Check if in fullscreen mode (cross-browser)
        const isFullscreen = document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement || 
                            document.msFullscreenElement;
        
        // Calculate scale to fit viewer (with padding, less padding in fullscreen)
        const padding = isFullscreen ? 20 : 40; // Less padding in fullscreen
        const scaleX = (viewerWidth - padding) / viewport.width;
        const scaleY = (viewerHeight - padding) / viewport.height;
        
        // Use the smaller scale to ensure it fits both dimensions
        const optimalScale = Math.min(scaleX, scaleY);
        
        // Set the scale
        this.pdfHandler.setScale(optimalScale);
        
        console.log('Optimal scale calculated:', optimalScale, 'Fullscreen:', !!isFullscreen);
    }

    async prerenderAdjacentPages() {
        if (this.isPrerendering || !this.pdfHandler.isPDFLoaded()) {
            return;
        }

        this.isPrerendering = true;

        try {
            // Pre-render next page
            if (this.currentPage < this.totalPages) {
                const nextPage = this.currentPage + 1;
                if (!this.pageCache.has(nextPage)) {
                    console.log('Pre-rendering page', nextPage);
                    const canvas = document.createElement('canvas');
                    await this.pdfHandler.renderPage(nextPage, canvas);
                    this.pageCache.set(nextPage, canvas);
                }
            }

            // Pre-render previous page
            if (this.currentPage > 1) {
                const prevPage = this.currentPage - 1;
                if (!this.pageCache.has(prevPage)) {
                    console.log('Pre-rendering page', prevPage);
                    const canvas = document.createElement('canvas');
                    await this.pdfHandler.renderPage(prevPage, canvas);
                    this.pageCache.set(prevPage, canvas);
                }
            }

            // Clean up cache - keep only adjacent pages
            this.cleanupCache();
        } catch (error) {
            console.error('Error pre-rendering pages:', error);
        } finally {
            this.isPrerendering = false;
        }
    }

    cleanupCache() {
        // Keep only current page and adjacent pages
        const pagesToKeep = new Set([
            this.currentPage - 1,
            this.currentPage,
            this.currentPage + 1
        ]);

        for (const pageNum of this.pageCache.keys()) {
            if (!pagesToKeep.has(pageNum)) {
                console.log('Removing cached page', pageNum);
                this.pageCache.delete(pageNum);
            }
        }
    }

    async renderPageWithTransition() {
        if (!this.pdfHandler.isPDFLoaded() || !this.webglUtils) {
            this.renderPage();
            return;
        }

        if (this.isTransitioning) {
            return;
        }

        this.isTransitioning = true;
        this.updatePageInfo();

        try {
            // Create a temporary canvas for the old page
            const oldCanvas = document.createElement('canvas');
            oldCanvas.width = this.pdfCanvas.width;
            oldCanvas.height = this.pdfCanvas.height;
            const oldCtx = oldCanvas.getContext('2d');
            oldCtx.drawImage(this.pdfCanvas, 0, 0);

            // Store the CSS display dimensions
            const displayWidth = this.pdfCanvas.style.width;
            const displayHeight = this.pdfCanvas.style.height;

            // Check if new page is cached, otherwise render it
            let newCanvas;
            if (this.pageCache.has(this.currentPage)) {
                console.log('Using cached page', this.currentPage);
                newCanvas = this.pageCache.get(this.currentPage);
            } else {
                console.log('Cache miss, rendering page', this.currentPage);
                newCanvas = document.createElement('canvas');
                await this.pdfHandler.renderPage(this.currentPage, newCanvas);
            }

            // Resize WebGL canvas to match - both pixel and display dimensions
            this.webglUtils.resize(newCanvas.width, newCanvas.height);
            this.webglCanvas.style.width = newCanvas.style.width;
            this.webglCanvas.style.height = newCanvas.style.height;
            this.webglCanvas.style.display = 'block';
            this.pdfCanvas.style.display = 'none';

            // Perform transition
            await this.webglUtils.performTransition(
                oldCanvas,
                newCanvas,
                this.currentTransition,
                800 // transition duration in ms
            );

            // Copy final result to PDF canvas - both pixel and display dimensions
            this.pdfCanvas.width = newCanvas.width;
            this.pdfCanvas.height = newCanvas.height;
            this.pdfCanvas.style.width = newCanvas.style.width;
            this.pdfCanvas.style.height = newCanvas.style.height;
            const ctx = this.pdfCanvas.getContext('2d');
            ctx.drawImage(newCanvas, 0, 0);

            // Hide WebGL canvas, show PDF canvas
            this.webglCanvas.style.display = 'none';
            this.pdfCanvas.style.display = 'block';

            // Pre-render adjacent pages for next navigation
            this.prerenderAdjacentPages();

        } catch (error) {
            console.error('Transition error:', error);
            // Fallback to regular render
            this.renderPage();
        } finally {
            this.isTransitioning = false;
        }
    }

    updatePageInfo() {
        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = this.totalPages;
        
        // Update button states
        this.prevButton.disabled = this.currentPage === 1;
        this.nextButton.disabled = this.currentPage === this.totalPages;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (this.viewer.requestFullscreen) {
                this.viewer.requestFullscreen();
            } else if (this.viewer.webkitRequestFullscreen) {
                this.viewer.webkitRequestFullscreen();
            } else if (this.viewer.msRequestFullscreen) {
                this.viewer.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    updateFullscreenButton() {
        const isFullscreen = document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement || 
                            document.msFullscreenElement;
        
        if (isFullscreen) {
            this.fullscreenBtn.textContent = 'Exit Fullscreen';
        } else {
            this.fullscreenBtn.textContent = 'Fullscreen';
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PDFTransitionsApp();
});
