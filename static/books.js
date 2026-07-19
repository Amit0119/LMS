async function getAllBooks(filters = {}) {
    try {
        return await apiClient.getAllBooks(filters);
    } catch (error) {
        console.error('Failed to load books:', error);
        showMessage("msg-box", "Failed to load books", "error");
        return [];
    }
}

async function displayAllBooks(filters = {}) {
    checkAuth("admin");
    
    const tableBody = document.getElementById("books-table-body");
    if (!tableBody) return;

    try {
        showMessage("msg-box", "Loading books...", "success");
        
        const response = await getAllBooks(filters);
        const books = response.books || [];
        
        if (books.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No books found in this category</td></tr>';
            hideMessage("msg-box");
            return;
        }

        tableBody.innerHTML = '';

        for (let book of books) {
            const row = document.createElement("tr");
            let coverUrl = '/static/my.logo.png'; // Updated to correct default image name
            if (book.cover) {
                if (book.cover.sizes && book.cover.sizes.thumbnail) {
                    coverUrl = book.cover.sizes.thumbnail;
                } else if (book.cover.url) {
                    coverUrl = book.cover.url;
                }
            }
            const available = book.copies?.available || 0;
            const statusBadge = available > 0 ? `<span class="badge available">Available</span>` : `<span class="badge error">Issued</span>`;
            
            row.innerHTML = `
                <td><img src="${escapeHTML(coverUrl)}" style="width:36px; height:50px; object-fit:cover; border-radius:4px;" alt="cover"></td>
                <td style="color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(book.id))}</td>
                <td>
                    <div style="font-weight: 500;">${escapeHTML(APIClient.escapeHtml(book.name))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(book.author))}</div>
                </td>
                <td>${escapeHTML(APIClient.escapeHtml(book.category))}</td>
                <td>${escapeHTML(available)} / ${escapeHTML(book.copies?.total || 0)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteBookConfirm('${escapeHTML(APIClient.escapeHtml(book.id))}')"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        }
        
        // Re-init icons for newly added elements
        if(typeof lucide !== 'undefined') lucide.createIcons();

        hideMessage("msg-box");
    } catch (error) {
        showMessage("msg-box", "Error loading books", "error");
    }
}

async function handleAddBook(event) {
    event.preventDefault();

    const bookId = document.getElementById("book-id").value.trim();
    const bookName = document.getElementById("book-name").value.trim();
    const author = document.getElementById("author").value.trim();
    const category = document.getElementById("category").value;
    const copies = parseInt(document.getElementById("copies").value);
    const pubYear = parseInt(document.getElementById("pub-year").value);

    if (!bookId || !bookName || !author || !category || !copies || !pubYear) {
        showMessage("msg-box", "All fields required", "error");
        return;
    }

    if (copies < 1) {
        showMessage("msg-box", "Copies must be >= 1", "error");
        return;
    }

    try {
        showMessage("msg-box", "Adding book...", "success");

        const response = await apiClient.addBook({
            id: bookId,
            name: bookName,
            author: author,
            category: category,
            copies: {
                total: copies,
                available: copies,
                issued: 0
            },
            publicationYear: pubYear
        });

        if (response.success) {
            const coverInput = document.getElementById("book-cover");
            if (coverInput && coverInput.files.length > 0) {
                showMessage("msg-box", "Uploading cover image...", "success");
                const uploadRes = await apiClient.uploadBookCover(bookId, coverInput.files[0]);
                if (!uploadRes.success) {
                    showMessage("msg-box", "Book added, but cover upload failed: " + (uploadRes.error || ''), "warning");
                    setTimeout(() => { window.location.href = "/viewbook"; }, 2000);
                    return;
                }
            }
            
            showMessage("msg-box", "Book added successfully!", "success");
            document.getElementById("add-book-form").reset();
            setTimeout(() => {
                window.location.href = "/viewbook";
            }, 1500);
        } else {
            showMessage("msg-box", response.error || "Failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function deleteBookConfirm(bookId) {
    if (!confirm("Delete this book?")) {
        return;
    }

    try {
        showMessage("msg-box", "Deleting...", "success");

        const response = await apiClient.deleteBook(bookId);

        if (response.success) {
            showMessage("msg-box", "Deleted!", "success");
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage("msg-box", response.error || "Failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function handleBookCoverUpload(event, bookId) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showMessage("msg-box", "Only PNG, JPG, GIF, WEBP", "error");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showMessage("msg-box", "Max 5MB", "error");
        return;
    }

    try {
        showMessage("msg-box", "Uploading...", "success");

        const response = await apiClient.uploadBookCover(bookId, file);

        if (response.success) {
            showMessage("msg-box", "Cover uploaded!", "success");
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage("msg-box", response.error || "Upload failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

// ===== DELETE BOOK PAGE FUNCTIONS =====

let bookToDelete = null;

async function handleFindBook(event) {
    event.preventDefault();

    const bookId = document.getElementById("book-id").value.trim();
    const bookName = document.getElementById("book-name").value.trim();

    if (!bookId && !bookName) {
        showMessage("msg-box", "Enter Book ID or Book Name", "error");
        return;
    }

    try {
        showMessage("msg-box", "Searching...", "success");

        if (bookId) {
            // Search by ID directly
            const book = await apiClient.getBook(bookId);
            if (book) {
                showBookDetails(book);
            } else {
                showMessage("msg-box", "Book not found", "error");
            }
        } else {
            // Search by name in all books (assuming API handles it or we search in current page, but for now we search globally if limit is high)
            const response = await apiClient.getAllBooks({ limit: 1000 });
            const books = response.books || [];
            const found = books.find(b => b.name.toLowerCase().includes(bookName.toLowerCase()));
            if (found) {
                showBookDetails(found);
            } else {
                showMessage("msg-box", "Book not found", "error");
            }
        }
    } catch (error) {
        showMessage("msg-box", error.message || "Search failed", "error");
    }
}

function showBookDetails(book) {
    bookToDelete = book;

    document.getElementById("detail-id").textContent = book.id;
    document.getElementById("detail-name").textContent = book.name;
    document.getElementById("detail-author").textContent = book.author;
    document.getElementById("detail-category").textContent = book.category;
    document.getElementById("detail-copies").textContent = book.copies?.total || 0;
    document.getElementById("detail-status").textContent = (book.copies?.available || 0) > 0 ? "Available" : "All Issued";

    document.getElementById("delete-confirm-section").classList.remove("hidden");
    hideMessage("msg-box");
}

async function handleDeleteBook() {
    if (!bookToDelete) {
        showMessage("msg-box", "No book selected", "error");
        return;
    }

    try {
        showMessage("msg-box", "Deleting...", "success");

        const response = await apiClient.deleteBook(bookToDelete.id);

        if (response.success) {
            showMessage("msg-box", "Book deleted successfully!", "success");
            document.getElementById("delete-confirm-section").classList.add("hidden");
            bookToDelete = null;
            document.getElementById("find-book-form").reset();
        } else {
            showMessage("msg-box", response.error || "Delete failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

let searchTimeout = null;

async function handleSearchBook(event) {
    if (event) event.preventDefault();
    
    // Debounce logic
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = document.getElementById("search-query").value.trim().toLowerCase();
        const category = document.getElementById("search-category")?.value || '';

        // Allow empty search to fetch all
        
        try {
            const tableBody = document.getElementById("search-results-body");
            if (!tableBody) return;
            
            showMessage("msg-box", "Searching...", "success");

            const filters = { limit: 1000 };
            if (category) filters.category = category;

            const response = await apiClient.getAllBooks(filters);
            const books = response.books || [];

            let results = books;
            if (query) {
                results = books.filter(b =>
                    b.name.toLowerCase().includes(query) ||
                    b.author.toLowerCase().includes(query) ||
                    b.id.toLowerCase().includes(query)
                );
            }

            if (results.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6">No books found</td></tr>';
                hideMessage("msg-box");
                return;
            }

        tableBody.innerHTML = '';
        results.forEach(book => {
            const row = document.createElement("tr");
            const coverUrl = (book.cover && book.cover.sizes && book.cover.sizes.thumbnail) ? book.cover.sizes.thumbnail : '/static/my_logo.jpg';
            row.innerHTML = `
                <td><img src="${escapeHTML(coverUrl)}" style="width:36px; height:50px; object-fit:cover; border-radius:4px;" alt="cover"></td>
                <td>
                    <div style="font-weight: 500;">${escapeHTML(APIClient.escapeHtml(book.name))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">by ${escapeHTML(APIClient.escapeHtml(book.author))}</div>
                </td>
                <td>${escapeHTML(APIClient.escapeHtml(book.category))}</td>
                <td>${(book.copies?.available || 0) > 0 ? '<span class="badge available">Available</span>' : '<span class="badge error">Checked Out</span>'}</td>
                <td>
                    ${(book.copies?.available || 0) > 0 ? `<button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="alert('In a real app, this would request the book!')">Request</button>` : '<span style="color: var(--text-muted); font-size: 0.8rem;">Unavailable</span>'}
                </td>
            `;
            tableBody.appendChild(row);
        });

        hideMessage("msg-box");
    } catch (error) {
        showMessage("msg-box", error.message || "Search failed", "error");
    }
    }, 500); // 500ms debounce
}

// Frontend search for tables (viewbook, etc.)
function searchTable() {
    const searchInput = document.getElementById('table-search');
    const categoryFilter = document.getElementById('category-filter');
    
    if (!searchInput) return;
    
    const filterText = searchInput.value.toLowerCase();
    const filterCategory = categoryFilter ? categoryFilter.value.toLowerCase() : '';
    
    const table = document.querySelector('.subpage-table-wrapper table');
    if (!table) return;
    
    const tr = table.getElementsByTagName('tr');
    
    // Loop through all table rows, and hide those who don't match the search query
    for (let i = 1; i < tr.length; i++) {
        let textMatch = false;
        let categoryMatch = true;
        
        const tdArray = tr[i].getElementsByTagName('td');
        if (tdArray.length > 0) {
            // Check text search
            if (filterText === '') {
                textMatch = true;
            } else {
                for (let j = 0; j < tdArray.length; j++) {
                    if (tdArray[j]) {
                        const txtValue = tdArray[j].textContent || tdArray[j].innerText;
                        if (txtValue.toLowerCase().indexOf(filterText) > -1) {
                            textMatch = true;
                            break;
                        }
                    }
                }
            }
            
            // Check category filter (assume category is 4th column, index 3 in viewbook.html)
            if (filterCategory !== '' && tdArray[3]) {
                const catValue = tdArray[3].textContent || tdArray[3].innerText;
                if (catValue.toLowerCase().trim() !== filterCategory) {
                    categoryMatch = false;
                }
            }
            
            if (textMatch && categoryMatch) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }
    }
}
