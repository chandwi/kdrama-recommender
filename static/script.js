class KDramaFinder {
    constructor() {
        this.currentOffset = 0;
        this.currentQuery = '';
        this.currentFilters = {};
        this.isLoading = false;
        this.hasMore = true;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadStats();
        await this.loadInitialDramas();
        await this.loadFilterOptions();
    }

    bindEvents() {
        const searchInput = document.getElementById('searchInput');
        const filters = ['genreFilter', 'statusFilter', 'ratingFilter'];
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        const modal = document.getElementById('dramaModal');

        // Search input with debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleSearch();
            }, 500);
        });

        // Filter changes
        filters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', () => {
                this.handleSearch();
            });
        });

        // Load more button
        loadMoreBtn.addEventListener('click', () => {
            this.loadMoreDramas();
        });

        // Modal close events
        modalCloseBtn.addEventListener('click', () => {
            this.closeModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Enter key for search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/stats');
            const data = await response.json();
            
            document.getElementById('totalDramas').textContent = data.total_dramas.toLocaleString();
            document.getElementById('avgRating').textContent = data.rating_stats.average || 'N/A';
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadFilterOptions() {
        try {
            const response = await fetch('/stats');
            const data = await response.json();
            
            // Populate status filter
            const statusFilter = document.getElementById('statusFilter');
            data.available_statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                statusFilter.appendChild(option);
            });

            // Populate genre filter with common genres
            const genreFilter = document.getElementById('genreFilter');
            const commonGenres = [
                'Drama', 'Comedy', 'Romance', 'Action & Adventure', 
                'Mystery', 'Thriller', 'Fantasy', 'Family'
            ];
            
            commonGenres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreFilter.appendChild(option);
            });

        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    }

    async handleSearch() {
        this.currentOffset = 0;
        this.hasMore = true;
        this.currentQuery = document.getElementById('searchInput').value.trim();
        
        this.currentFilters = {
            genre: document.getElementById('genreFilter').value,
            status: document.getElementById('statusFilter').value,
            min_rating: parseFloat(document.getElementById('ratingFilter').value) || 0
        };

        document.getElementById('dramaGrid').innerHTML = '';
        document.getElementById('loadMoreBtn').style.display = 'none';
        
        await this.loadDramas(true);
    }

    async loadInitialDramas() {
        await this.loadDramas(true);
    }

    async loadMoreDramas() {
        await this.loadDramas(false);
    }

    async loadDramas(isNewSearch = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);

        try {
            const params = new URLSearchParams({
                q: this.currentQuery,
                genre: this.currentFilters.genre || '',
                status: this.currentFilters.status || '',
                min_rating: this.currentFilters.min_rating || 0,
                limit: 20,
                offset: this.currentOffset
            });

            const response = await fetch(`/search?${params}`);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            
            this.renderDramas(data.dramas, isNewSearch);
            this.updateResultsInfo(data, isNewSearch);
            
            this.currentOffset += data.dramas.length;
            this.hasMore = data.page_info.has_more;
            
            document.getElementById('loadMoreBtn').style.display = 
                this.hasMore ? 'block' : 'none';

        } catch (error) {
            console.error('Failed to load dramas:', error);
            this.showError('Failed to load dramas. Please try again.');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    renderDramas(dramas, isNewSearch = false) {
        const grid = document.getElementById('dramaGrid');
        
        if (isNewSearch) {
            grid.innerHTML = '';
        }

        dramas.forEach(drama => {
            const card = this.createDramaCard(drama);
            grid.appendChild(card);
        });
    }

    createDramaCard(drama) {
        const card = document.createElement('div');
        card.className = 'drama-card';
        card.addEventListener('click', () => this.showDramaDetails(drama.tmdb_id));

        const posterUrl = drama.poster_path 
            ? `https://image.tmdb.org/t/p/w500${drama.poster_path}` 
            : null;

        const genres = drama.genres ? 
            drama.genres.split(',').slice(0, 3).map(g => 
                `<span class="genre-tag">${g.trim()}</span>`
            ).join('') : '';

        card.innerHTML = `
            <div class="drama-poster">
                ${posterUrl ? 
                    `<img src="${posterUrl}" alt="${drama.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="no-image" style="display: none;"><i class="fas fa-tv"></i></div>` :
                    `<div class="no-image"><i class="fas fa-tv"></i></div>`
                }
                ${drama.rating > 0 ? `<div class="drama-rating">${drama.rating}</div>` : ''}
            </div>
            <div class="drama-info">
                <h3 class="drama-title">${drama.title}</h3>
                ${drama.original_title && drama.original_title !== drama.title ? 
                    `<p class="drama-original">${drama.original_title}</p>` : ''}
                <div class="drama-meta">
                    ${drama.first_air_date ? `<span><i class="fas fa-calendar"></i> ${new Date(drama.first_air_date).getFullYear()}</span>` : ''}
                    ${drama.episodes ? `<span><i class="fas fa-list"></i> ${Math.floor(drama.episodes)} eps</span>` : ''}
                    ${drama.network ? `<span><i class="fas fa-broadcast-tower"></i> ${drama.network}</span>` : ''}
                </div>
                ${drama.overview ? `<p class="drama-overview">${drama.overview}</p>` : ''}
                <div class="drama-genres">${genres}</div>
            </div>
        `;

        return card;
    }

    async showDramaDetails(tmdbId) {
        try {
            const response = await fetch(`/drama/${tmdbId}`);
            if (!response.ok) throw new Error('Failed to load drama details');
            
            const drama = await response.json();
            this.renderModal(drama);
            this.showModal();
            
        } catch (error) {
            console.error('Failed to load drama details:', error);
            this.showError('Failed to load drama details. Please try again.');
        }
    }

    renderModal(drama) {
        document.getElementById('modalTitle').textContent = drama.title;
        
        const posterUrl = drama.poster_path 
            ? `https://image.tmdb.org/t/p/w500${drama.poster_path}` 
            : null;
        
        const backdropUrl = drama.backdrop_path 
            ? `https://image.tmdb.org/t/p/w1280${drama.backdrop_path}` 
            : null;

        const genres = drama.genres ? 
            drama.genres.split(',').map(g => 
                `<span class="genre-tag">${g.trim()}</span>`
            ).join('') : '';

        document.getElementById('modalBody').innerHTML = `
            ${backdropUrl ? `<img src="${backdropUrl}" alt="${drama.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 10px; margin-bottom: 2rem;">` : ''}
            
            <div style="display: grid; grid-template-columns: ${posterUrl ? 'auto 1fr' : '1fr'}; gap: 2rem; margin-bottom: 2rem;">
                ${posterUrl ? `<img src="${posterUrl}" alt="${drama.title}" style="width: 200px; height: auto; border-radius: 10px;">` : ''}
                <div>
                    ${drama.original_title && drama.original_title !== drama.title ? 
                        `<p style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">${drama.original_title}</p>` : ''}
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        ${drama.rating > 0 ? `
                        <div>
                            <strong>Rating:</strong><br>
                            <span style="font-size: 1.5rem; color: #667eea;">${drama.rating}</span>
                            ${drama.vote_count ? `<span style="color: #666;"> (${drama.vote_count} votes)</span>` : ''}
                        </div>` : ''}
                        
                        ${drama.first_air_date ? `
                        <div>
                            <strong>First Aired:</strong><br>
                            ${new Date(drama.first_air_date).toLocaleDateString()}
                        </div>` : ''}
                        
                        ${drama.last_air_date && drama.last_air_date !== drama.first_air_date ? `
                        <div>
                            <strong>Last Aired:</strong><br>
                            ${new Date(drama.last_air_date).toLocaleDateString()}
                        </div>` : ''}
                        
                        ${drama.status ? `
                        <div>
                            <strong>Status:</strong><br>
                            ${drama.status}
                        </div>` : ''}
                        
                        ${drama.episodes ? `
                        <div>
                            <strong>Episodes:</strong><br>
                            ${Math.floor(drama.episodes)}
                        </div>` : ''}
                        
                        ${drama.average_runtime ? `
                        <div>
                            <strong>Runtime:</strong><br>
                            ${Math.floor(drama.average_runtime)} min
                        </div>` : ''}
                        
                        ${drama.network ? `
                        <div>
                            <strong>Network:</strong><br>
                            ${drama.network}
                        </div>` : ''}
                    </div>
                    
                    ${genres ? `
                    <div style="margin-bottom: 1.5rem;">
                        <strong>Genres:</strong><br>
                        <div style="margin-top: 0.5rem;">${genres}</div>
                    </div>` : ''}
                </div>
            </div>
            
            ${drama.overview ? `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Synopsis</h3>
                <p style="line-height: 1.6;">${drama.overview}</p>
            </div>` : ''}
            
            ${drama.main_cast ? `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Main Cast</h3>
                <p>${drama.main_cast}</p>
            </div>` : ''}
            
            ${drama.keywords ? `
            <div>
                <h3 style="margin-bottom: 1rem;">Keywords</h3>
                <p style="color: #666;">${drama.keywords}</p>
            </div>` : ''}
        `;
    }

    updateResultsInfo(data, isNewSearch) {
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsCount = document.getElementById('resultsCount');
        
        if (this.currentQuery || Object.values(this.currentFilters).some(f => f)) {
            resultsTitle.textContent = 'Search Results';
        } else {
            resultsTitle.textContent = 'Popular K-Dramas';
        }
        
        if (isNewSearch) {
            resultsCount.textContent = `${data.total} ${data.total === 1 ? 'drama' : 'dramas'} found`;
        }
    }

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
    }

    showModal() {
        document.getElementById('dramaModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('dramaModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KDramaFinder();
});