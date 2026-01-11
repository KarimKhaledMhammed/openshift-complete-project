// Bookstore Application JavaScript
const API_URL = '/api';

// DOM Elements
const booksContainer = document.getElementById('booksContainer');
const addBookForm = document.getElementById('addBookForm');
const editBookForm = document.getElementById('editBookForm');
const editModal = document.getElementById('editModal');
const searchInput = document.getElementById('searchInput');
const connectionStatus = document.getElementById('connectionStatus');
const bookCount = document.getElementById('bookCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
    setupEventListeners();
    checkConnection();
});

// Event Listeners
function setupEventListeners() {
    addBookForm.addEventListener('submit', handleAddBook);
    editBookForm.addEventListener('submit', handleEditBook);
    searchInput.addEventListener('input', handleSearch);
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });
}

// Check API Connection
async function checkConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            connectionStatus.textContent = '✅ Connected';
            connectionStatus.className = 'status-indicator connected';
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        connectionStatus.textContent = '❌ Disconnected';
        connectionStatus.className = 'status-indicator error';
    }
}

// Load Books
async function loadBooks() {
    booksContainer.innerHTML = '<div class="loading">Loading books...</div>';

    try {
        const response = await fetch(`${API_URL}/books`);
        const books = await response.json();

        if (books.length === 0) {
            booksContainer.innerHTML = '<div class="no-books">📚 No books in inventory. Add your first book!</div>';
        } else {
            displayBooks(books);
        }

        bookCount.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;
    } catch (error) {
        console.error('Error loading books:', error);
        booksContainer.innerHTML = '<div class="no-books">❌ Error loading books. Check backend connection.</div>';
    }
}

// Display Books
function displayBooks(books) {
    booksContainer.innerHTML = books.map(book => `
        <div class="book-card" data-id="${book.id}">
            <h3>${escapeHtml(book.title)}</h3>
            <p class="author">by ${escapeHtml(book.author)}</p>
            <p class="isbn">ISBN: ${escapeHtml(book.isbn)}</p>
            <div class="details">
                <span class="price">$${parseFloat(book.price).toFixed(2)}</span>
                <span class="stock">Stock: ${book.stock}</span>
            </div>
            <div class="actions">
                <button class="btn btn-edit" onclick="openEditModal(${book.id})">✏️ Edit</button>
                <button class="btn btn-danger" onclick="deleteBook(${book.id})">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// Add Book
async function handleAddBook(e) {
    e.preventDefault();

    const book = {
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        isbn: document.getElementById('isbn').value,
        price: parseFloat(document.getElementById('price').value),
        stock: parseInt(document.getElementById('stock').value)
    };

    try {
        const response = await fetch(`${API_URL}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(book)
        });

        if (response.ok) {
            addBookForm.reset();
            loadBooks();
            showNotification('Book added successfully!', 'success');
        } else {
            throw new Error('Failed to add book');
        }
    } catch (error) {
        console.error('Error adding book:', error);
        showNotification('Error adding book', 'error');
    }
}

// Open Edit Modal
async function openEditModal(id) {
    try {
        const response = await fetch(`${API_URL}/books/${id}`);
        const book = await response.json();

        document.getElementById('editId').value = book.id;
        document.getElementById('editTitle').value = book.title;
        document.getElementById('editAuthor').value = book.author;
        document.getElementById('editIsbn').value = book.isbn;
        document.getElementById('editPrice').value = book.price;
        document.getElementById('editStock').value = book.stock;

        editModal.classList.add('show');
    } catch (error) {
        console.error('Error loading book:', error);
        showNotification('Error loading book details', 'error');
    }
}

// Close Modal
function closeModal() {
    editModal.classList.remove('show');
}

// Edit Book
async function handleEditBook(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const book = {
        title: document.getElementById('editTitle').value,
        author: document.getElementById('editAuthor').value,
        isbn: document.getElementById('editIsbn').value,
        price: parseFloat(document.getElementById('editPrice').value),
        stock: parseInt(document.getElementById('editStock').value)
    };

    try {
        const response = await fetch(`${API_URL}/books/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(book)
        });

        if (response.ok) {
            closeModal();
            loadBooks();
            showNotification('Book updated successfully!', 'success');
        } else {
            throw new Error('Failed to update book');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        showNotification('Error updating book', 'error');
    }
}

// Delete Book
async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
        const response = await fetch(`${API_URL}/books/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadBooks();
            showNotification('Book deleted successfully!', 'success');
        } else {
            throw new Error('Failed to delete book');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        showNotification('Error deleting book', 'error');
    }
}

// Search Books
async function handleSearch() {
    const query = searchInput.value.toLowerCase();

    if (query.length === 0) {
        loadBooks();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/books`);
        const books = await response.json();

        const filtered = books.filter(book =>
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            booksContainer.innerHTML = '<div class="no-books">🔍 No books found matching your search.</div>';
        } else {
            displayBooks(filtered);
        }

        bookCount.textContent = `${filtered.length} book${filtered.length !== 1 ? 's' : ''} found`;
    } catch (error) {
        console.error('Error searching books:', error);
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show Notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
