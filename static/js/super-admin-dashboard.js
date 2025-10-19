// ================================
// GLOBAL VARIABLES AND CONSTANTS
// ================================

let userData = null;
let companies = [];
let currentStatusFilter = 'all';
let currentRestoreType = 'companies';
const API_BASE_URL = 'http://127.0.0.1:8000';

// ================================
// AUTHENTICATION & SESSION MANAGEMENT
// ================================

/**
 * Enhanced API fetch with token refresh logic
 */
async function apiFetch(url, options = {}) {
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    // ✅ Build headers dynamically
    const headers = {
        ...options.headers,
        "Authorization": `Bearer ${accessToken}`
    };

    // ❌ DO NOT force JSON if sending FormData
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = options.headers?.["Content-Type"] || "application/json";
    }

    let response = await fetch(url, { ...options, headers });

    // Handle token expiration
    if (response.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${API_BASE_URL}/refresh`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${refreshToken}`
            }
        });

        if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem("access_token", refreshData.access_token);

            const retryHeaders = {
                ...headers,
                "Authorization": `Bearer ${refreshData.access_token}`
            };

            // Again, do not set Content-Type if body is FormData
            if (!(options.body instanceof FormData)) {
                retryHeaders["Content-Type"] = options.headers?.["Content-Type"] || "application/json";
            }

            response = await fetch(url, { ...options, headers: retryHeaders });
        } else {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
    }

    return response;
}

/**
 * Check authentication on page load
 */
window.onload = function() {
    const storedUserData = localStorage.getItem("userData");
    if (!storedUserData) {
        window.location.href = "/ui";
        return;
    }

    userData = JSON.parse(storedUserData);
    if (userData.role !== "super_admin") {
        window.location.href = "/ui";
        return;
    }

    document.getElementById("userName").textContent = userData.name;
    document.getElementById("userInitial").textContent = userData.name.charAt(0).toUpperCase();
    loadDashboardData();
    loadCompaniesForSelect();
    loadCountries();
};

/**
 * Logout function
 */
function logout() {
    localStorage.clear();
    window.location.href = "/ui";  
}


// ================================
// NAVIGATION & UI MANAGEMENT
// ================================

/**
 * Set active navigation link based on current page
 */
function setActiveNavLink() {
    const currentPage = localStorage.getItem('currentPage') || 'dashboard';
    
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`#sidebar .nav-link[data-page="${currentPage}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

/**
 * Update active nav link when clicking a menu item
 */
function updateActiveNavLink(page) {
    localStorage.setItem('currentPage', page);
    setActiveNavLink();
}

/**
 * Toggle sidebar visibility
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    
    if (sidebar.style.width === '0px' || sidebar.style.width === '') {
        sidebar.style.width = 'var(--sidebar-width)';
        content.style.marginLeft = 'var(--sidebar-width)';
    } else {
        sidebar.style.width = '0';
        content.style.marginLeft = '0';
    }
}

// ================================
// DASHBOARD FUNCTIONS
// ================================

/**
 * Load dashboard statistics
 */
async function loadDashboardData() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/dashboard`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById("companiesCount").textContent = data.companies_count;
            document.getElementById("usersCount").textContent = data.users_count;
            document.getElementById("inactiveCompaniesCount").textContent = data.inactive_companies_count || 0;
            document.getElementById("inactiveUsersCount").textContent = data.inactive_users_count || 0;
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// ================================
// AUDIT LOGS FUNCTIONS (Super Admin)
// ================================

async function loadAuditLogs() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('audit-logs');
    document.getElementById('dataTitle').textContent = 'Audit Logs';
    document.getElementById('dataFilterDropdown').style.display = 'none';
    document.getElementById('statusFilter').style.display = 'none';
    document.getElementById('roleFilter').style.display = 'none';

    const companyFilter = document.getElementById('companyFilter');
    companyFilter.style.display = 'block';
    companyFilter.innerHTML = `<option value="">All Companies</option>`; // default option

    try {
        // 🔹 Fetch company list
        const companyRes = await apiFetch(`${API_BASE_URL}/companies/list`, {
            headers: { "X-User-Role": "super_admin" }
        });

        let companyNameMap = {};
        if (companyRes.ok) {
            const companyData = await companyRes.json();
            companyData.companies.forEach(c => {
                const option = document.createElement("option");
                option.value = c.company_id ?? "None";
                option.textContent = c.company_name;
                companyFilter.appendChild(option);

                companyNameMap[c.company_id ?? "None"] = c.company_name;
            });
        }

        // 🔹 Load all logs by default
        await fetchAuditLogs("", companyNameMap);

        // 🔹 Filter on company change
        companyFilter.onchange = () => {
            fetchAuditLogs(companyFilter.value, companyNameMap);
        };

    } catch (error) {
        document.getElementById('dataContent').innerHTML =
            `<div class="alert alert-danger">Error loading audit logs: ${error.message}</div>`;
    }
}

async function fetchAuditLogs(companyId = "", companyNameMap = {}) {
    try {
        const url = companyId
            ? `${API_BASE_URL}/audit-logs?company_id=${companyId}`
            : `${API_BASE_URL}/audit-logs`;

        const response = await apiFetch(url, {
            headers: { "X-User-Role": "super_admin" }
        });

        if (response.ok) {
            const data = await response.json();
            displayAuditLogs(data.logs || [], companyNameMap);
        } else {
            document.getElementById('dataContent').innerHTML =
                `<div class="alert alert-danger">Failed to load audit logs</div>`;
        }
    } catch (error) {
        document.getElementById('dataContent').innerHTML =
            `<div class="alert alert-danger">Error loading audit logs: ${error.message}</div>`;
    }
}
function displayAuditLogs(logs, companyNameMap = {}) {
    const content = document.getElementById("dataContent");

    if (!logs.length) {
        content.innerHTML = `<p class="text-muted text-center py-4">No audit logs found</p>`;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table table-striped table-hover" id="auditLogsTable">
                <thead class="table-light">
                    <tr>
                        <th>Screen</th>
                        <th>Field Name</th>
                        <th>Action</th>
                        <th>Old Value</th>
                        <th>New Value</th>
                        <th>Done By</th>
                        <th>Timestamp (IST)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    logs.forEach((log) => {
        // 🔹 Convert UTC → IST
        let istTime = '-';
        if (log.timestamp) {
            const utcDate = new Date(log.timestamp);
            const istOffsetMs = 5.5 * 60 * 60 * 1000; // +5:30 hrs
            const istDate = new Date(utcDate.getTime() + istOffsetMs);
            istTime = istDate.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            });
        }

        // 🔹 Extract old/new data and changed fields
        const oldDataObj = log.old_data || {};
        const newDataObj = log.new_data || {};
        const fieldNames = Array.from(new Set([...Object.keys(oldDataObj), ...Object.keys(newDataObj)]));

        if (fieldNames.length === 0) {
            // no fields changed — still log action
            html += `
                <tr>
                    <td>${log.screen || '-'}</td>
                    <td>-</td>
                    <td>${log.action || '-'}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${log.name || '-'}</td>
                    <td>${istTime}</td>
                </tr>
            `;
        } else {
            fieldNames.forEach((field) => {
                const oldVal = oldDataObj[field] ?? '-';
                const newVal = newDataObj[field] ?? '-';

                html += `
                    <tr>
                        <td>${log.screen || '-'}</td>
                        <td>${field}</td>
                        <td>${log.action || '-'}</td>
                        <td>${oldVal}</td>
                        <td>${newVal}</td>
                        <td>${log.name || '-'}</td>
                        <td>${istTime}</td>
                    </tr>
                `;
            });
        }
    });

    html += `</tbody></table></div>`;
    content.innerHTML = html;

    // 🔹 Initialize DataTable
    if ($.fn.DataTable.isDataTable('#auditLogsTable')) {
        $('#auditLogsTable').DataTable().destroy();
    }

    $('#auditLogsTable').DataTable({
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[6, 'asc']], // sort by timestamp
        language: {
            search: "Search logs:",
            lengthMenu: "Show _MENU_ logs per page",
            info: "Showing _START_ to _END_ of _TOTAL_ logs",
            infoEmpty: "No logs available",
            infoFiltered: "(filtered from _MAX_ total logs)"
        }
    });
}



/**
 * Show main dashboard view
 */
function showDashboard() {
    document.getElementById('statsCards').style.display = 'flex';
    updateActiveNavLink('dashboard');
    document.getElementById('dataTitle').textContent = 'Recent Data';
    document.getElementById('dataFilterDropdown').style.display = 'block';
    document.getElementById('statusFilter').style.display = 'none';
    document.getElementById('companyFilter').style.display = 'none';
    document.getElementById('roleFilter').style.display = 'none';
    document.getElementById('dataContent').innerHTML = `
        <div class="text-center py-4">
            <i class="fas fa-tachometer-alt fa-3x text-muted mb-3"></i>
            <h5>Dashboard Overview</h5>
            <p class="text-muted">Select an option from the sidebar to view specific data</p>
        </div>
    `;
}

// ================================
// COUNTRY & STATE MANAGEMENT
// ================================

/**
 * Load countries for dropdowns
 */
async function loadCountries() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/countries`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const countries = await response.json();
            const countrySelect = document.getElementById("companyCountry");
            const editCountrySelect = document.getElementById("editCompanyCountry");
            
            // Clear existing options
            countrySelect.innerHTML = '<option value="">Select Country</option>';
            if (editCountrySelect) editCountrySelect.innerHTML = '<option value="">Select Country</option>';
            
            // Add countries to dropdowns
            countries.forEach(country => {
                const option = document.createElement("option");
                option.value = country.id;
                option.textContent = country.name;
                countrySelect.appendChild(option);
                
                if (editCountrySelect) {
                    const editOption = document.createElement("option");
                    editOption.value = country.id;
                    editOption.textContent = country.name;
                    editCountrySelect.appendChild(editOption);
                }
            });
            
            // Set default to India
            countrySelect.value = "in";
            if (editCountrySelect) editCountrySelect.value = "in";
            
            // Load states for India
            loadStates("in");
            if (editCountrySelect) loadEditStates("in");
            
            // Load active banks for dropdowns
            loadActiveBanks();
        }
    } catch (error) {
        console.error("Error loading countries:", error);
    }
}

/**
 * Load states for create form
 */
async function loadStates(countryId) {
    if (!countryId) return;
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/countries/${countryId}/states`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const states = await response.json();
            const stateSelect = document.getElementById("companyState");
            
            // Clear existing options
            stateSelect.innerHTML = '<option value="">Select State</option>';
            
            // Add states to dropdown
            states.forEach(state => {
                const option = document.createElement("option");
                option.value = state.name;
                option.textContent = state.name;
                stateSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading states:", error);
    }
}

/**
 * Load states for edit form
 */
async function loadEditStates(countryId) {
    if (!countryId) return;
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/countries/${countryId}/states`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const states = await response.json();
            const stateSelect = document.getElementById("editCompanyState");
            
            // Clear existing options
            stateSelect.innerHTML = '<option value="">Select State</option>';
            
            // Add states to dropdown
            states.forEach(state => {
                const option = document.createElement("option");
                option.value = state.name;
                option.textContent = state.name;
                stateSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading states:", error);
    }
}

// ================================
// BANK MANAGEMENT FUNCTIONS
// ================================

/**
 * Load active banks for dropdowns
 */
async function loadActiveBanks() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks?status=active`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const banks = await response.json();
            updateBankDropdowns(banks);
        }
    } catch (error) {
        console.error("Error loading banks:", error);
    }
}

/**
 * Update bank dropdowns in forms
 */
function updateBankDropdowns(banks) {
    // Create form bank dropdown
    const bankSelect = document.getElementById("bankName");
    if (bankSelect) {
        bankSelect.innerHTML = '<option value="">Select Bank</option>';
        banks.forEach(bank => {
            const option = document.createElement("option");
            option.value = bank.bank_name;
            option.textContent = `${bank.bank_name} (${bank.ifsc_prefix})`;
            option.dataset.ifscPrefix = bank.ifsc_prefix;
            bankSelect.appendChild(option);
        });
    }
    
    // Edit form bank dropdown
    const editBankSelect = document.getElementById("editBankName");
    if (editBankSelect) {
        editBankSelect.innerHTML = '<option value="">Select Bank</option>';
        banks.forEach(bank => {
            const option = document.createElement("option");
            option.value = bank.bank_name;
            option.textContent = `${bank.bank_name} (${bank.ifsc_prefix})`;
            option.dataset.ifscPrefix = bank.ifsc_prefix;
            editBankSelect.appendChild(option);
        });
    }
}

/**
 * Update IFSC code when bank is selected (create form)
 */
function updateIfscCode(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const ifscPrefix = selectedOption?.dataset.ifscPrefix || '';
    
    // Update the prefix display
    document.getElementById('ifscPrefix').textContent = ifscPrefix || '____';
    
    // Clear the suffix input
    document.getElementById('ifscSuffix').value = '';
    
    // Enable/disable suffix input based on selection
    document.getElementById('ifscSuffix').disabled = !ifscPrefix;
}

/**
 * Update IFSC code when bank is selected (edit form)
 */
function updateEditIfscCode(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const ifscPrefix = selectedOption?.dataset.ifscPrefix || '';
    
    // Update the prefix display
    document.getElementById('editIfscPrefixDisplay').textContent = ifscPrefix || '____';
    
    // Clear the suffix input if bank changed and prefix doesn't match current IFSC
    const currentIfsc = document.getElementById('editIfscCode').value || '';
    if (ifscPrefix && currentIfsc.substring(0, 4) !== ifscPrefix) {
        document.getElementById('editIfscSuffix').value = '';
    }
    
    // Enable/disable suffix input based on selection
    document.getElementById('editIfscSuffix').disabled = !ifscPrefix;
}

/**
 * Combine prefix and suffix to create full IFSC code
 */
function getFullIfscCode(prefixId, suffixId) {
    const prefix = document.getElementById(prefixId).textContent;
    const suffix = document.getElementById(suffixId).value.toUpperCase();
    
    if (prefix === '____' || !suffix) {
        return '';
    }
    
    return prefix + suffix;
}

/**
 * Validate IFSC code format
 */
function validateIfscCode(ifscCode) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifscCode);
}

/**
 * Find bank by name and return IFSC prefix
 */
async function findBankByName(bankName) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks?status=active`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const banks = await response.json();
            const bank = banks.find(b => b.bank_name === bankName);
            return bank ? bank.ifsc_prefix : '';
        }
    } catch (error) {
        console.error("Error finding bank:", error);
    }
    return '';
}

// ================================
// COMPANY MANAGEMENT FUNCTIONS
// ================================

/**
 * Load companies for dropdown selects
 */
async function loadCompaniesForSelect() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            companies = await response.json();
            const select = document.getElementById("userCompany");
            const editSelect = document.getElementById("editUserCompany");
            
            select.innerHTML = '<option value="">Select Company</option>';
            if (editSelect) editSelect.innerHTML = '<option value="">Choose One</option>';
            
            companies.forEach(company => {
                const option = document.createElement("option");
                option.value = company.id;
                option.textContent = company.name;
                select.appendChild(option);
                
                if (editSelect) {
                    const editOption = document.createElement("option");
                    editOption.value = company.id;
                    editOption.textContent = company.name;
                    editSelect.appendChild(editOption);
                }
            });
        }
    } catch (error) {
        console.error("Error loading companies:", error);
    }
}

/**
 * Load companies with optional status filter
 */
async function loadCompanies(status = 'all') {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('companies');
    document.getElementById('dataTitle').textContent = 'Companies';
    document.getElementById('dataFilterDropdown').style.display = 'block';
    document.getElementById('statusFilter').style.display = 'block';
    document.getElementById('companyFilter').style.display = 'none';
    document.getElementById('roleFilter').style.display = 'none';
    
    try {
        let url = `${API_BASE_URL}/companies`;
        if (status !== 'all') {
            url += `?status=${status}`;
        }
        
        const response = await apiFetch(url, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            companies = await response.json();
            
            // Fetch usage data for each company
            const companiesWithUsage = await Promise.all(
                companies.map(async (company) => {
                    try {
                        const usageResponse = await apiFetch(`${API_BASE_URL}/companies/${company.id}/usage`, {
                            headers: {
                                "X-User-Role": "super_admin"
                            }
                        });
                        
                        if (usageResponse.ok) {
                            const usageData = await usageResponse.json();
                            return {
                                ...company,
                                monthly_page_limit: usageData.monthly_page_limit,
                                current_usage: usageData.current_usage
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching usage for company ${company.id}:`, error);
                    }
                    return company;
                })
            );
            
            displayCompanies(companiesWithUsage);
        }
    } catch (error) {
        showMessage("Error loading companies", "error");
    }
}

/**
 * Display companies in a table
 */
function displayCompanies(companies) {
    const content = document.getElementById("dataContent");
    if (companies.length === 0) {
        content.innerHTML = `<p class="text-muted text-center py-4">No companies found</p>`;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table table-striped table-hover" id="companiesTable">
                <thead class="table-light">
                    <tr>
                        <th>S.No</th>
                        <th>Company Name</th>
                        <th>Total Pages</th>
                        <th>Used Pages</th>
                        <th>Remaining Pages</th>
                        <th>API Keys</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    companies.forEach((company, index) => {
        const hasGeminiKey = company.gemini_api_key ? 'text-success' : 'text-muted';
        const hasLlamaKey = company.llama_api_key ? 'text-success' : 'text-muted';
        
        // Calculate usage statistics
        const totalPages = company.monthly_page_limit || 1000;
        const usedPages = company.current_usage || 0;
        const remainingPages = Math.max(0, totalPages - usedPages);
        const usagePercentage = totalPages > 0 ? (usedPages / totalPages) * 100 : 0;
        
        // Determine color based on usage
        let usageClass = "text-success";
        if (usagePercentage >= 75) usageClass = "text-warning";
        if (usagePercentage >= 90) usageClass = "text-danger";

        // Determine status icon
        const statusIconClass = company.status === 'active' ? 'fas fa-toggle-on text-success' : 'fas fa-toggle-off text-danger';
        const statusTitle = company.status === 'active' ? 'Active' : 'Inactive';

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${company.name}</td>
                <td>${totalPages.toLocaleString()}</td>
                <td class="${usageClass}">${usedPages.toLocaleString()}</td>
                <td>${remainingPages.toLocaleString()}</td>
                <td>
                    <i class="fas fa-key ${hasGeminiKey}" title="Gemini API Key"></i>
                    <i class="fas fa-key ${hasLlamaKey}" title="Llama API Key"></i>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick='openEditCompanyModal(${JSON.stringify(company)})' title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick='openUsageModal("${company.id}", "${company.name}")' title="Usage">
                            <i class="fas fa-chart-pie"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick='confirmDeleteCompany("${company.id}")' title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick='toggleCompanyStatus("${company.id}", "${company.status}", this)' title="${statusTitle}">
                            <i class="${statusIconClass}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;

    // Initialize DataTable
    if ($.fn.DataTable.isDataTable('#companiesTable')) {
        $('#companiesTable').DataTable().destroy();
    }
    
    $('#companiesTable').DataTable({
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[1, 'asc']], // order by Company Name
        language: {
            search: "Search companies:",
            lengthMenu: "Show _MENU_ companies per page",
            info: "Showing _START_ to _END_ of _TOTAL_ companies",
            infoEmpty: "No companies available",
            infoFiltered: "(filtered from _MAX_ total companies)"
        }
    });
}

/**
 * Toggle company status (active/inactive)
 */
function toggleCompanyStatus(companyId, currentStatus, button) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const statusText = newStatus === 'active' ? 'Active' : 'Inactive';
    
    if (confirm(`Are you sure you want to change this company's status to ${statusText}?`)) {
        updateCompanyStatus(companyId, newStatus, button);
    }
}

/**
 * Update company status via API
 */
async function updateCompanyStatus(companyId, status, dropdown) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/status?status=${status}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            }
        });

        if (response.ok) {
            showMessage(`Company status updated to ${status}`, "success");
            // Update the current status attribute
            dropdown.setAttribute('data-current-status', status);
            loadDashboardData();
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to update company status", "error");
            // Reset dropdown on error
            const currentStatus = dropdown.getAttribute('data-current-status');
            dropdown.value = currentStatus;
        }
    } catch (error) {
        showMessage("Error updating company status", "error");
        // Reset dropdown on error
        const currentStatus = dropdown.getAttribute('data-current-status');
        dropdown.value = currentStatus;
    }
}

// ================================
// COMPANY USAGE & LIMIT MANAGEMENT
// ================================

/**
 * Open usage modal for a company
 */
function openUsageModal(companyId, companyName) {
    const modalHtml = `
        <div class="modal fade" id="usageModal" tabindex="-1" aria-labelledby="usageModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="usageModalLabel">Usage Details - ${companyName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="usageModalBody">
                        <div class="text-center py-4">
                            <div class="spinner-border" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-2">Loading usage data...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM if it doesn't exist
    if (!document.getElementById('usageModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('usageModal'));
    modal.show();
    
    // Load usage data
    loadCompanyUsageDetails(companyId);
}

/**
 * Load detailed company usage information
 */
async function loadCompanyUsageDetails(companyId) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/usage`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const usageData = await response.json();
            
            const usagePercentage = usageData.monthly_page_limit > 0 
                ? (usageData.current_usage / usageData.monthly_page_limit) * 100 
                : 0;
            
            let progressClass = "bg-success";
            if (usagePercentage >= 75) progressClass = "bg-warning";
            if (usagePercentage >= 90) progressClass = "bg-danger";
            
            document.getElementById('usageModalBody').innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card mb-4">
                            <div class="card-header">
                                <h6 class="mb-0">Usage Summary</h6>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6">
                                        <div class="border rounded p-3 text-center">
                                            <h4 class="text-primary">${usageData.current_usage.toLocaleString()}</h4>
                                            <small class="text-muted">Pages Used</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="border rounded p-3 text-center">
                                            <h4 class="text-success">${(usageData.monthly_page_limit - usageData.current_usage).toLocaleString()}</h4>
                                            <small class="text-muted">Pages Remaining</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <div class="d-flex justify-content-between mb-1">
                                        <span>Usage Progress</span>
                                        <span>${usagePercentage.toFixed(1)}%</span>
                                    </div>
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar ${progressClass}" role="progressbar" 
                                            style="width: ${usagePercentage}%;" 
                                            aria-valuenow="${usagePercentage}" 
                                            aria-valuemin="0" 
                                            aria-valuemax="100">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">Update Page Limit</h6>
                            </div>
                            <div class="card-body">
                                <form id="updateLimitForm" onsubmit="updateCompanyLimit(event, '${companyId}')">
                                    
                                    <!-- Paid Amount Input -->
                                    <div class="mb-3">
                                        <label for="amountPaid" class="form-label">Enter Paid Amount (₹)</label>
                                        <input type="number" class="form-control" id="amountPaid" min="1" required
                                            oninput="calculatePageLimit()">
                                    </div>

                                    <!-- Page Limit (auto calculated) -->
                                    <div class="mb-3">
                                        <label for="pageLimit" class="form-label">Monthly Page Limit</label>
                                        <input type="number" class="form-control" id="pageLimit" readonly>
                                    </div>

                                    <button type="submit" class="btn btn-primary">Update Limit</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            document.getElementById('usageModalBody').innerHTML = `
                <div class="alert alert-danger">Error loading usage details</div>
            `;
        }
    } catch (error) {
        document.getElementById('usageModalBody').innerHTML = `
            <div class="alert alert-danger">Error loading usage details: ${error.message}</div>
        `;
    }
}

/**
 * Calculate page limit based on paid amount
 */
function calculatePageLimit() {
    const amount = parseFloat(document.getElementById("amountPaid").value) || 0;
    const pages = Math.floor(amount / 0.5); // 50 paise per page
    document.getElementById("pageLimit").value = pages;
}

/**
 * Update company page limit
 */
async function updateCompanyLimit(event, companyId) {
    event.preventDefault();
    
    const newLimit = parseInt(document.getElementById('pageLimit').value);
    
    if (!newLimit || newLimit <= 0) {
        showMessage("Invalid page limit", "error");
        return;
    }
    const amountPaid = parseFloat(document.getElementById('amountPaid').value);

    if (!amountPaid || amountPaid <= 0) {
        showMessage("Invalid amount entered", "error");
        return;
    }

    try {
        const response = await apiFetch(
            `${API_BASE_URL}/companies/${companyId}/limit?monthly_page_limit=${newLimit}&amount_paid=${amountPaid}`,
            {
                method: "PATCH",
                headers: {
                    "X-User-Role": "super_admin"
                }
            }
        );

        if (response.ok) {
            showMessage("Page limit updated successfully", "success");
            loadCompanyUsageDetails(companyId);
            loadCompanies(currentStatusFilter);
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to update page limit", "error");
        }
    } catch (error) {
        showMessage("Error updating page limit", "error");
    }
}

// ================================
// VALIDATION FUNCTIONS
// ================================

/**
 * Real-time validation for text fields with character restrictions
 */
function setupRealTimeValidation() {
    // Company name and legal name validation (letters and spaces only, max 20 chars)
    const nameFields = ['companyName', 'companyLegalName', 'editCompanyName', 'editCompanyLegalName'];
    nameFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateNameField(this);
            });
            field.addEventListener('blur', function() {
                validateNameField(this);
            });
        }
    });
    
    // Address validation (max 70 chars)
    const addressFields = ['registeredAddress', 'bankAddress', 'editRegisteredAddress', 'editBankAddress'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateAddressField(this);
            });
            field.addEventListener('blur', function() {
                validateAddressField(this);
            });
        }
    });
    
    // City validation (letters and spaces only, max 30 chars)
    const cityFields = ['companyCity', 'editCompanyCity'];
    cityFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateCityField(this);
            });
            field.addEventListener('blur', function() {
                validateCityField(this);
            });
        }
    });
    
    // Pincode validation (exactly 6 digits)
    const pincodeFields = ['companyPincode', 'editCompanyPincode'];
    pincodeFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validatePincodeField(this);
            });
            field.addEventListener('blur', function() {
                validatePincodeField(this);
            });
        }
    });
    
    // Mobile validation (exactly 10 digits)
    const mobileFields = ['companyMobile', 'editCompanyMobile'];
    mobileFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateMobileField(this);
            });
            field.addEventListener('blur', function() {
                validateMobileField(this);
            });
        }
    });
    
    // Website validation
    const websiteFields = ['companyWebsite', 'editCompanyWebsite'];
    websiteFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', function() {
                validateWebsiteField(this);
            });
        }
    });
    
    // Domain validation
    const domainFields = ['companyDomain', 'editCompanyDomain'];
    domainFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', function() {
                validateDomainField(this);
            });
        }
    });
    
    // Quotation prefix validation (max 10 chars)
    const prefixFields = ['quotationPrefix', 'editQuotationPrefix'];
    prefixFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validatePrefixField(this);
            });
            field.addEventListener('blur', function() {
                validatePrefixField(this);
            });
        }
    });
    
    // GST validation (15 chars, Indian GST format)
    const gstFields = ['companyGST', 'editCompanyGST'];
    gstFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateGSTField(this);
            });
            field.addEventListener('blur', function() {
                validateGSTField(this);
            });
        }
    });
    
    // Account number validation (9-18 digits)
    const accountFields = ['accountNumber', 'editAccountNumber'];
    accountFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateAccountNumberField(this);
            });
            field.addEventListener('blur', function() {
                validateAccountNumberField(this);
            });
        }
    });
    
    // Account holder name validation (letters and spaces only, max 40 chars)
    const holderFields = ['accountHolderName', 'editAccountHolderName'];
    holderFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateAccountHolderField(this);
            });
            field.addEventListener('blur', function() {
                validateAccountHolderField(this);
            });
        }
    });
    
    // Bank branch validation (max 30 chars)
    const branchFields = ['bankBranch', 'editBankBranch'];
    branchFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateBranchField(this);
            });
            field.addEventListener('blur', function() {
                validateBranchField(this);
            });
        }
    });
}

/**
 * Validate name fields (company name, legal name)
 */
function validateNameField(field) {
    const value = field.value.trim();
    const isValid = /^[A-Za-z\s]{1,20}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate address fields
 */
function validateAddressField(field) {
    const value = field.value.trim();
    const isValid = value.length <= 70;
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate city fields
 */
function validateCityField(field) {
    const value = field.value.trim();
    const isValid = /^[A-Za-z\s]{0,30}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate pincode fields
 */
function validatePincodeField(field) {
    const value = field.value.trim();
    const isValid = /^\d{6}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate mobile fields
 */
function validateMobileField(field) {
    const value = field.value.trim();
    const isValid = /^\d{10}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate website fields
 */
function validateWebsiteField(field) {
    const value = field.value.trim();
    if (!value) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    const isValid = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(value);
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate domain fields
 */
function validateDomainField(field) {
    const value = field.value.trim();
    if (!value) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    const isValid = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(value);
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate quotation prefix fields
 */
function validatePrefixField(field) {
    const value = field.value.trim();
    const isValid = value.length <= 10;
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate GST fields
 */
function validateGSTField(field) {
    const value = field.value.trim().toUpperCase();
    if (!value) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    // Indian GST format: 2 chars (state code) + 10 chars (PAN) + 1 char (entity) + 1 char (Z) + 1 digit
    const isValid = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(value);
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate account number fields
 */
function validateAccountNumberField(field) {
    const value = field.value.trim();
    const isValid = /^\d{9,18}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate account holder name fields
 */
function validateAccountHolderField(field) {
    const value = field.value.trim();
    const isValid = /^[A-Za-z\s]{1,40}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate bank branch fields
 */
function validateBranchField(field) {
    const value = field.value.trim();
    const isValid = value.length <= 30;
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate all fields before form submission
 */
function validateAllFields(formType = 'create') {
    let isValid = true;
    
    if (formType === 'create') {
        // Company name
        const companyName = document.getElementById('companyName');
        if (!validateNameField(companyName)) isValid = false;
        
        // Legal name
        const legalName = document.getElementById('companyLegalName');
        if (legalName.value && !validateNameField(legalName)) isValid = false;
        
        // Registered address
        const address = document.getElementById('registeredAddress');
        if (address.value && !validateAddressField(address)) isValid = false;
        
        // City
        const city = document.getElementById('companyCity');
        if (city.value && !validateCityField(city)) isValid = false;
        
        // Pincode
        const pincode = document.getElementById('companyPincode');
        if (pincode.value && !validatePincodeField(pincode)) isValid = false;
        
        // Mobile
        const mobile = document.getElementById('companyMobile');
        if (mobile.value && !validateMobileField(mobile)) isValid = false;
        
        // Website
        const website = document.getElementById('companyWebsite');
        if (website.value && !validateWebsiteField(website)) isValid = false;
        
        // Domain
        const domain = document.getElementById('companyDomain');
        if (domain.value && !validateDomainField(domain)) isValid = false;
        
        // Quotation prefix
        const prefix = document.getElementById('quotationPrefix');
        if (prefix.value && !validatePrefixField(prefix)) isValid = false;
        
        // GST
        const gst = document.getElementById('companyGST');
        if (gst.value && !validateGSTField(gst)) isValid = false;
        
        // Account number
        const account = document.getElementById('accountNumber');
        if (account.value && !validateAccountNumberField(account)) isValid = false;
        
        // Account holder
        const holder = document.getElementById('accountHolderName');
        if (holder.value && !validateAccountHolderField(holder)) isValid = false;
        
        // Bank branch
        const branch = document.getElementById('bankBranch');
        if (branch.value && !validateBranchField(branch)) isValid = false;
        
        // Bank address
        const bankAddress = document.getElementById('bankAddress');
        if (bankAddress.value && !validateAddressField(bankAddress)) isValid = false;
        
    } else if (formType === 'edit') {
        // Company name
        const companyName = document.getElementById('editCompanyName');
        if (companyName.value && !validateNameField(companyName)) isValid = false;
        
        // Legal name
        const legalName = document.getElementById('editCompanyLegalName');
        if (legalName.value && !validateNameField(legalName)) isValid = false;
        
        // Registered address
        const address = document.getElementById('editRegisteredAddress');
        if (address.value && !validateAddressField(address)) isValid = false;
        
        // City
        const city = document.getElementById('editCompanyCity');
        if (city.value && !validateCityField(city)) isValid = false;
        
        // Pincode
        const pincode = document.getElementById('editCompanyPincode');
        if (pincode.value && !validatePincodeField(pincode)) isValid = false;
        
        // Mobile
        const mobile = document.getElementById('editCompanyMobile');
        if (mobile.value && !validateMobileField(mobile)) isValid = false;
        
        // Website
        const website = document.getElementById('editCompanyWebsite');
        if (website.value && !validateWebsiteField(website)) isValid = false;
        
        // Domain
        const domain = document.getElementById('editCompanyDomain');
        if (domain.value && !validateDomainField(domain)) isValid = false;
        
        // Quotation prefix
        const prefix = document.getElementById('editQuotationPrefix');
        if (prefix.value && !validatePrefixField(prefix)) isValid = false;
        
        // GST
        const gst = document.getElementById('editCompanyGST');
        if (gst.value && !validateGSTField(gst)) isValid = false;
        
        // Account number
        const account = document.getElementById('editAccountNumber');
        if (account.value && !validateAccountNumberField(account)) isValid = false;
        
        // Account holder
        const holder = document.getElementById('editAccountHolderName');
        if (holder.value && !validateAccountHolderField(holder)) isValid = false;
        
        // Bank branch
        const branch = document.getElementById('editBankBranch');
        if (branch.value && !validateBranchField(branch)) isValid = false;
        
        // Bank address
        const bankAddress = document.getElementById('editBankAddress');
        if (bankAddress.value && !validateAddressField(bankAddress)) isValid = false;
    }
    
    return isValid;
}

// ================================
// COMPANY FORM HANDLING
// ================================

/**
 * Open company creation modal
 */
function openCompanyModal() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('add-company');
    const modal = new bootstrap.Modal(document.getElementById('companyModal'));
    modal.show();
    
    // Setup validation after modal is shown
    setTimeout(() => {
        setupRealTimeValidation();
    }, 100);
}

/**
 * Close company creation modal
 */
function closeCompanyModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('companyModal'));
    modal.hide();
    document.getElementById("companyForm").reset();
}

/**
 * Handle company form submission
 */
document.getElementById("companyForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    // Validate all fields before submission
    if (!validateAllFields('create')) {
        showMessage("Please correct the validation errors before submitting", "error");
        return;
    }
    
    // Collect form data
    const name = (document.getElementById("companyName").value || "").trim();
    const legal_name = (document.getElementById("companyLegalName").value || "").trim();
    const admin_email = (document.getElementById("companyAdminEmail").value || "").trim();
    const admin_password = (document.getElementById("companyAdminPassword").value || "").trim();
    const admin_password_confirm = (document.getElementById("companyAdminPasswordConfirm").value || "").trim();
    const geminiApiKey = document.getElementById("geminiApiKey").value.trim();
    const llamaApiKey = document.getElementById("llamaApiKey").value.trim();
    const geminiModel = document.getElementById("geminiModel").value;
    const monthlyPageLimit = parseInt(document.getElementById("monthlyPageLimit").value) || 1000;
    
    // Company details
    const logo_url = document.getElementById("logoUrl").value.trim();
    const email = document.getElementById("companyEmail").value.trim();
    const mobile = document.getElementById("companyMobile").value.trim();
    const website = document.getElementById("companyWebsite").value.trim();
    const domain = document.getElementById("companyDomain").value.trim();
    const country = (document.getElementById("companyCountry").value || "").trim();
    const state = (document.getElementById("companyState").value || "").trim();
    const city = document.getElementById("companyCity").value.trim();
    const pincode = document.getElementById("companyPincode").value.trim();
    const quotation_prefix = document.getElementById("quotationPrefix").value.trim();
    const registered_address = document.getElementById("registeredAddress").value.trim();
    
    // Compliance details
    const gst = document.getElementById("companyGST").value.trim();
    
    // Bank details
    const bankName = document.getElementById("bankName").value;
    const ifscCode = getFullIfscCode('ifscPrefix', 'ifscSuffix');
    const account_number = document.getElementById("accountNumber").value.trim();
    const account_holder_name = document.getElementById("accountHolderName").value.trim();
    const bank_branch = document.getElementById("bankBranch").value.trim();
    const bank_address = document.getElementById("bankAddress").value.trim();

    // Validation
    const missing = [];
    if (!name) missing.push("company name");
    if (!admin_email) missing.push("admin email");
    if (!admin_password) missing.push("admin password");
    if (!admin_password_confirm) missing.push("confirm password");
    if (missing.length) {
        showMessage("Please fill required fields: " + missing.join(", "), "error");
        return;
    }
    if (admin_password.length < 6) {
        showMessage("Admin password must be at least 6 characters.", "error");
        return;
    }
    if (admin_password !== admin_password_confirm) {
        showMessage("Passwords do not match.", "error");
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(admin_email)) {
        showMessage("Please enter a valid admin email.", "error");
        return;
    }

    // Bank details validation
    if (bankName && (!ifscCode || !account_number || !account_holder_name)) {
        showMessage("Please complete all required bank details", "error");
        return;
    }

    if (ifscCode && !validateIfscCode(ifscCode)) {
        showMessage("Invalid IFSC code format. It should be 4 letters + 0 + 6 letters/numbers", "error");
        return;
    }

    // Duplicate checks
    try {
        const listRes = await apiFetch(`${API_BASE_URL}/companies`, {
            headers: { "X-User-Role": "super_admin" }
        });
        if (listRes.ok) {
            const list = await listRes.json();
            const nameExists = (list || []).some(c => (c.name || '').trim().toLowerCase() === name.toLowerCase());
            if (nameExists) {
                showMessage("Company name already exists.", "error");
                return;
            }
        }
    } catch {}

    try {
        const usersRes = await apiFetch(`${API_BASE_URL}/users`, {
            headers: { "X-User-Role": "super_admin" }
        });
        if (usersRes.ok) {
            const users = await usersRes.json();
            const emailExists = (users || []).some(u => (u.email || '').trim().toLowerCase() === admin_email.toLowerCase());
            if (emailExists) {
                showMessage("Admin email already exists.", "error");
                return;
            }
        }
    } catch {}

    // Prepare company data
    const companyData = { 
        name, 
        legal_name: legal_name || undefined,
        admin_email, 
        admin_password,
        gemini_api_key: geminiApiKey || undefined, 
        llama_api_key: llamaApiKey || undefined, 
        gemini_model: geminiModel,
        monthly_page_limit: monthlyPageLimit,
        
        // Company details
        logo_url: logo_url || undefined,
        email: email || undefined,
        mobile: mobile || undefined,
        website: website || undefined,
        domain: domain || undefined,
        country: country || undefined,
        state: state || undefined,
        city: city || undefined,
        pincode: pincode || undefined,
        quotation_prefix: quotation_prefix || undefined,
        registered_address: registered_address || undefined,
        
        // Compliance details
        gst: gst || undefined,
        
        // Bank details
        bank_name: bankName || undefined,
        ifsc_code: ifscCode || undefined,
        account_number: account_number || undefined,
        account_holder_name: account_holder_name || undefined,
        bank_branch: bank_branch || undefined,
        bank_address: bank_address || undefined
    };

    try {
        const response = await apiFetch(`${API_BASE_URL}/companies`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify(companyData)
        });

        if (response.ok) {
            const company = await response.json();
            
            // Upload logo if selected
            const logoFile = document.getElementById("companyLogo").files[0];
            if (logoFile) {
                await uploadCompanyLogo(company.id);
            }
            
            showMessage("Company created successfully!", "success");
            closeCompanyModal();
            loadDashboardData();
            loadCompaniesForSelect();
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to create company", "error");
        }
    } catch (error) {
        showMessage("Error creating company", "error");
    }
});

// ================================
// COMPANY EDITING FUNCTIONS
// ================================

/**
 * Open edit company modal with pre-filled data
 */
function openEditCompanyModal(company) {
    document.getElementById("editCompanyId").value = company.id;
    document.getElementById("editCompanyName").value = company.name || "";
    document.getElementById("editCompanyLegalName").value = company.legal_name || "";
    document.getElementById("editRegisteredAddress").value = company.registered_address || "";
    document.getElementById("editCompanyCountry").value = "in"; // Default to India
    document.getElementById("editCompanyState").value = company.state || "";
    document.getElementById("editCompanyCity").value = company.city || "";
    document.getElementById("editCompanyPincode").value = company.pincode || "";
    document.getElementById("editCompanyEmail").value = company.email || "";
    document.getElementById("editCompanyMobile").value = company.mobile || "";
    document.getElementById("editCompanyWebsite").value = company.website || "";
    document.getElementById("editCompanyDomain").value = company.domain || "";
    document.getElementById("editQuotationPrefix").value = company.quotation_prefix || "";
    document.getElementById("editLogoUrl").value = company.logo_url || "";
    
    // Compliance details
    document.getElementById("editCompanyGST").value = company.gst || "";
    
    // Bank details
    const bankSelect = document.getElementById("editBankName");
    if (bankSelect && company.bank_name) {
        // Wait for banks to load
        setTimeout(() => {
            for (let i = 0; i < bankSelect.options.length; i++) {
                if (bankSelect.options[i].value === company.bank_name) {
                    bankSelect.selectedIndex = i;
                    updateEditIfscCode(bankSelect);
                    break;
                }
            }
            
            if (company.bank_name && bankSelect.value !== company.bank_name) {
                findBankByName(company.bank_name).then(ifscPrefix => {
                    if (ifscPrefix) {
                        const option = document.createElement("option");
                        option.value = company.bank_name;
                        option.textContent = `${company.bank_name} (${ifscPrefix})`;
                        option.dataset.ifscPrefix = ifscPrefix;
                        option.selected = true;
                        bankSelect.appendChild(option);
                        updateEditIfscCode(bankSelect);
                    }
                });
            }
        }, 100);
    }

    // Pre-fill IFSC code if exists
    if (company.ifsc_code) {
        const ifscPrefix = company.ifsc_code.substring(0, 4);
        const ifscSuffix = company.ifsc_code.substring(4);
        
        document.getElementById('editIfscPrefixDisplay').textContent = ifscPrefix;
        document.getElementById('editIfscSuffix').value = ifscSuffix;
        document.getElementById('editIfscCode').value = company.ifsc_code;
    }

    // Pre-fill other bank details
    document.getElementById("editAccountNumber").value = company.account_number || "";
    document.getElementById("editAccountHolderName").value = company.account_holder_name || "";
    document.getElementById("editBankBranch").value = company.bank_branch || "";
    document.getElementById("editBankAddress").value = company.bank_address || "";
    
    // API key fields
    document.getElementById("editGeminiApiKey").value = "";
    document.getElementById("editLlamaApiKey").value = "";
    document.getElementById("editGeminiModel").value = company.gemini_model || "gemini-2.0-flash";
    
    // Monthly page limit - set to readonly
    document.getElementById("editMonthlyPageLimit").value = company.monthly_page_limit || 1000;
    document.getElementById("editMonthlyPageLimit").readOnly = true;
    
    // Logo preview
    if (company.logo_url) {
        const logoUrl = company.logo_url.startsWith('http') ? company.logo_url : `${API_BASE_URL}${company.logo_url}`;
        document.getElementById("editLogoPreviewImg").src = logoUrl;
        document.getElementById("editLogoPreview").style.display = "block";
    } else {
        document.getElementById("editLogoPreview").style.display = "none";
    }
    
    // Add logo upload event listener
    const logoInput = document.getElementById("editCompanyLogo");
    if (logoInput) {
        logoInput.onchange = function(e) {
            handleLogoPreview(e, "editLogoPreviewImg", "editLogoPreview");
        };
    }
    
    // Setup validation after modal is shown
    setTimeout(() => {
        setupRealTimeValidation();
    }, 100);
    
    const modal = new bootstrap.Modal(document.getElementById('editCompanyModal'));
    modal.show();
}

/**
 * Close edit company modal
 */
function closeEditCompanyModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCompanyModal'));
    modal.hide();
    document.getElementById("editCompanyForm").reset();
}

/**
 * Handle edit company form submission
 */
document.getElementById("editCompanyForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    // Validate all fields before submission
    if (!validateAllFields('edit')) {
        showMessage("Please correct the validation errors before submitting", "error");
        return;
    }
    
    const id = document.getElementById("editCompanyId").value;
    const payload = {};
    
    // Collect form data
    const n = document.getElementById("editCompanyName").value.trim();
    if (n) payload.name = n;
    
    // Company details
    const logo_url = document.getElementById("editLogoUrl").value.trim();
    const email = document.getElementById("editCompanyEmail").value.trim();
    const mobile = document.getElementById("editCompanyMobile").value.trim();
    const website = document.getElementById("editCompanyWebsite").value.trim();
    const domain = document.getElementById("editCompanyDomain").value.trim();
    const country = (document.getElementById("companyCountry").value || "").trim();
    const state = (document.getElementById("editCompanyState").value || "").trim();
    const city = document.getElementById("editCompanyCity").value.trim();
    const pincode = document.getElementById("editCompanyPincode").value.trim();
    const quotation_prefix = document.getElementById("editQuotationPrefix").value.trim();
    const registered_address = document.getElementById("editRegisteredAddress").value.trim();
    
    // Compliance details
    const gst = document.getElementById("editCompanyGST").value.trim();
    
    // Bank details
    const bankName = document.getElementById("editBankName").value;
    const ifscCode = getFullIfscCode('editIfscPrefixDisplay', 'editIfscSuffix');
    const account_number = document.getElementById("editAccountNumber").value.trim();
    const account_holder_name = document.getElementById("editAccountHolderName").value.trim();
    const bank_branch = document.getElementById("editBankBranch").value.trim();
    const bank_address = document.getElementById("editBankAddress").value.trim();
                
    // API key fields
    const geminiKey = document.getElementById("editGeminiApiKey").value.trim();
    const llamaKey = document.getElementById("editLlamaApiKey").value.trim();
    const geminiModel = document.getElementById("editGeminiModel").value;
    const monthlyPageLimit = parseInt(document.getElementById("editMonthlyPageLimit").value) || undefined;
    
    // Add fields to payload if they have values
    if (logo_url !== "") payload.logo_url = logo_url;
    if (email !== "") payload.email = email;
    if (mobile !== "") payload.mobile = mobile;
    if (website !== "") payload.website = website;
    if (domain !== "") payload.domain = domain;
    if (country !== "") payload.country = country;
    if (state !== "") payload.state = state;
    if (city !== "") payload.city = city;
    if (pincode !== "") payload.pincode = pincode;
    if (quotation_prefix !== "") payload.quotation_prefix = quotation_prefix;
    if (registered_address !== "") payload.registered_address = registered_address;
    
    if (gst !== "") payload.gst = gst;
    
    // Bank details validation
    if (bankName && (!ifscCode || !account_number || !account_holder_name)) {
        showMessage("Please complete all required bank details", "error");
        return;
    }

    if (ifscCode && !validateIfscCode(ifscCode)) {
        showMessage("Invalid IFSC code format. It should be 4 letters + 0 + 6 letters/numbers", "error");
        return;
    }

    // Add bank details to payload
    if (bankName) payload.bank_name = bankName;
    if (ifscCode) payload.ifsc_code = ifscCode;
    if (account_number) payload.account_number = account_number;
    if (account_holder_name) payload.account_holder_name = account_holder_name;
    if (bank_branch) payload.bank_branch = bank_branch;
    if (bank_address) payload.bank_address = bank_address;
    
    if (geminiKey !== "") payload.gemini_api_key = geminiKey;
    if (llamaKey !== "") payload.llama_api_key = llamaKey;
    if (geminiModel) payload.gemini_model = geminiModel;
    if (monthlyPageLimit) payload.monthly_page_limit = monthlyPageLimit;
    
    if (Object.keys(payload).length === 0) {
        showMessage("Nothing to update", "error");
        return;
    }
    
    try {
        // First update company details
        const res = await apiFetch(`${API_BASE_URL}/companies/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            // Then upload logo if selected
            const logoFile = document.getElementById("editCompanyLogo").files[0];
            if (logoFile) {
                try {
                    await uploadCompanyLogo(id);
                } catch (error) {
                    console.warn("Logo upload failed, but company details were updated:", error);
                    // Continue with success message even if logo upload fails
                }
            }
            
            showMessage("Company updated successfully!", "success");
            closeEditCompanyModal();
            loadCompanies();
            loadCompaniesForSelect();
        } else {
            const t = await res.text();
            showMessage(t || "Failed to update company", "error");
        }
    } catch (error) {
        showMessage("Error updating company: " + error.message, "error");
    }
});

// Initialize validation when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupRealTimeValidation();
});
// ================================
// USER MANAGEMENT FUNCTIONS
// ================================

/**
 * Load users with optional status filter
 */
async function loadUsers(status = 'all') {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('users');
    document.getElementById('dataTitle').textContent = 'Users';
    document.getElementById('dataFilterDropdown').style.display = 'block';
    document.getElementById('statusFilter').style.display = 'block';
    document.getElementById('companyFilter').style.display = 'flex';
    document.getElementById('roleFilter').style.display = 'flex';

    try {
        let url = `${API_BASE_URL}/users`;
        if (status !== 'all') {
            url += `?status=${status}`;
        }

        const response = await apiFetch(url, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });

        if (response.ok) {
            const users = await response.json();

            // ✅ Populate company dropdown
            const companySelect = document.getElementById('companyFilter');
            companySelect.innerHTML = `<option value="all">Select Company</option>`;
            companies.forEach(company => {
                companySelect.innerHTML += `<option value="${company.id}">${company.name}</option>`;
            });
            displayUsers(users);
            addUserFilterListeners(users);
        }
    } catch (error) {
        showMessage("Error loading users", "error");
    }
}

/**
 * Display users in a table
 */
function displayUsers(users) {
    const content = document.getElementById("dataContent");
    if (users.length === 0) {
        content.innerHTML = `<p class="text-muted text-center py-4">No users found</p>`;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table table-striped table-hover" id="usersTable">
                <thead class="table-light">
                    <tr>
                        <th>S.No</th>
                        <th>Company</th>
                        <th>User Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach((user, index) => {
        const company = companies.find(c => c.id === user.company_id);
        const badgeClass = user.role === 'company_admin' ? 'badge-admin' : 'badge-user';
        const isActive = (user.status || 'active') === 'active';
        const statusIcon = isActive 
            ? `<i class="fas fa-toggle-on text-success" title="Active"></i>` 
            : `<i class="fas fa-toggle-off text-danger" title="Inactive"></i>`;

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${company ? company.name : 'Unknown'}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="badge ${badgeClass}">${user.role}</span></td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" 
                            onclick='openEditUserModal(${JSON.stringify(user)})' title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" 
                            onclick='confirmDeleteUser("${user.id}")' title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-outline-secondary status-toggle-btn" 
                            data-user-id="${user.id}" 
                            data-current-status="${user.status || 'active'}" 
                            title="Toggle Status">
                            ${statusIcon}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;

    // ✅ Initialize DataTable
    if ($.fn.DataTable.isDataTable('#usersTable')) {
        $('#usersTable').DataTable().destroy();
    }

    $('#usersTable').DataTable({
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[1, 'asc']],
        language: {
            search: "Search users:",
            lengthMenu: "Show _MENU_ users per page",
            info: "Showing _START_ to _END_ of _TOTAL_ users",
            infoEmpty: "No users available",
            infoFiltered: "(filtered from _MAX_ total users)"
        }
    });

    // ✅ Status icon click listener
    document.querySelectorAll('.status-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const currentStatus = this.getAttribute('data-current-status');
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            confirmUserStatusChange(userId, newStatus, this);
        });
    });
}

/**
 * Add filter listeners for users
 */
function addUserFilterListeners(users) {
    const companyFilter = document.getElementById('companyFilter');
    const roleFilter = document.getElementById('roleFilter');

    const applyFilters = () => {
        const companyValue = companyFilter.value;
        const roleValue = roleFilter.value;

        let filteredUsers = users;

        if (companyValue !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.company_id == companyValue);
        }
        if (roleValue !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === roleValue);
        }

        displayUsers(filteredUsers);
    };

    companyFilter.onchange = applyFilters;
    roleFilter.onchange = applyFilters;
}

// ================================
// VALIDATION FUNCTIONS FOR USER FORM
// ================================

/**
 * Setup real-time validation for user form fields
 */
function setupUserRealTimeValidation() {
    // Name fields validation (letters only, max 20 chars)
    const nameFields = ['newUserName', 'newUserMiddle', 'newUserLast', 'editUserName'];
    nameFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateNameField(this);
            });
            field.addEventListener('blur', function() {
                validateNameField(this);
            });
        }
    });

    // Mobile validation (exactly 10 digits)
    const mobileFields = ['userMobile'];
    mobileFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateMobileField(this);
            });
            field.addEventListener('blur', function() {
                validateMobileField(this);
            });
        }
    });

    // Department and Designation validation (max 30 chars)
    const deptFields = ['userDepartment', 'userDesignation'];
    deptFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateDepartmentField(this);
            });
            field.addEventListener('blur', function() {
                validateDepartmentField(this);
            });
        }
    });

    // Date validation (DOB and DOJ cannot be in future)
    const dateFields = ['userDob', 'userDoj'];
    dateFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', function() {
                validateDateField(this);
            });
        }
    });

    // Email validation
    const emailFields = ['userEmail', 'editUserEmail'];
    emailFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', function() {
                validateEmailField(this);
            });
        }
    });

    // Password validation
    const passwordFields = ['userPassword', 'editUserPassword'];
    passwordFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validatePasswordField(this);
            });
            field.addEventListener('blur', function() {
                validatePasswordField(this);
            });
        }
    });
}

/**
 * Validate name fields (first, middle, last names)
 */
function validateNameField(field) {
    const value = field.value.trim();
    // Allow letters and spaces, with length restrictions
    const isValid = /^[A-Za-z\s]{0,50}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate mobile field
 */
function validateMobileField(field) {
    const value = field.value.trim();
    const isValid = /^\d{10}$/.test(value);
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate department and designation fields
 */
function validateDepartmentField(field) {
    const value = field.value.trim();
    const isValid = value.length <= 30;
    
    if (value && !isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate date fields (DOB and DOJ cannot be in future)
 */
function validateDateField(field) {
    const value = field.value;
    if (!value) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    const selectedDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison
    
    const isValid = selectedDate <= today;
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate email field
 */
function validateEmailField(field) {
    const value = field.value.trim();
    if (!value) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(value);
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate password field
 */
function validatePasswordField(field) {
    const value = field.value;
    // For create form, password is required, for edit form it's optional
    const isRequired = field.hasAttribute('required');
    
    if (!value && !isRequired) {
        field.classList.remove('is-invalid');
        return true;
    }
    
    const isValid = value.length >= 6;
    
    if (!isValid) {
        field.classList.add('is-invalid');
        return false;
    } else {
        field.classList.remove('is-invalid');
        return true;
    }
}

/**
 * Validate all user fields before form submission
 */
function validateAllUserFields(formType = 'create') {
    let isValid = true;
    
    if (formType === 'create') {
        // First name (required)
        const firstName = document.getElementById('newUserName');
        if (!validateNameField(firstName) || !firstName.value.trim()) {
            isValid = false;
        }
        
        // Middle name (optional)
        const middleName = document.getElementById('newUserMiddle');
        if (middleName.value && !validateNameField(middleName)) {
            isValid = false;
        }
        
        // Last name (optional)
        const lastName = document.getElementById('newUserLast');
        if (lastName.value && !validateNameField(lastName)) {
            isValid = false;
        }
        
        // Mobile
        const mobile = document.getElementById('userMobile');
        if (mobile.value && !validateMobileField(mobile)) {
            isValid = false;
        }
        
        // Department
        const department = document.getElementById('userDepartment');
        if (department.value && !validateDepartmentField(department)) {
            isValid = false;
        }
        
        // Designation
        const designation = document.getElementById('userDesignation');
        if (designation.value && !validateDepartmentField(designation)) {
            isValid = false;
        }
        
        // Date of Birth
        const dob = document.getElementById('userDob');
        if (dob.value && !validateDateField(dob)) {
            isValid = false;
        }
        
        // Date of Joining
        const doj = document.getElementById('userDoj');
        if (doj.value && !validateDateField(doj)) {
            isValid = false;
        }
        
        // Email (required)
        const email = document.getElementById('userEmail');
        if (!validateEmailField(email) || !email.value.trim()) {
            isValid = false;
        }
        
        // Password (required)
        const password = document.getElementById('userPassword');
        if (!validatePasswordField(password) || !password.value) {
            isValid = false;
        }
        
        // Company (required)
        const company = document.getElementById('userCompany');
        if (!company.value) {
            company.classList.add('is-invalid');
            isValid = false;
        } else {
            company.classList.remove('is-invalid');
        }
        
    } else if (formType === 'edit') {
        // Full name
        const fullName = document.getElementById('editUserName');
        if (fullName.value && !validateNameField(fullName)) {
            isValid = false;
        }
        
        // Email
        const email = document.getElementById('editUserEmail');
        if (email.value && !validateEmailField(email)) {
            isValid = false;
        }
        
        // Password
        const password = document.getElementById('editUserPassword');
        if (password.value && !validatePasswordField(password)) {
            isValid = false;
        }
    }
    
    return isValid;
}

// ================================
// USER FORM HANDLING
// ================================

/**
 * Open user creation modal
 */
function openUserModal() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('add-user');
    if (!companies || companies.length === 0) {
        loadCompaniesForSelect();
        showMessage("Loading companies. Please try again in a moment.", "error");
        return;
    }
    const companySelect = document.getElementById("userCompany");
    if (companySelect && (!companySelect.value || companySelect.value === "")) {
        companySelect.value = companies[0]?.id || "";
    }
    
    // Setup validation after modal is shown
    setTimeout(() => {
        setupUserRealTimeValidation();
    }, 100);
    
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

/**
 * Close user creation modal
 */
function closeUserModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
    modal.hide();
    document.getElementById("userForm").reset();
    
    // Reset validation states
    const invalidFields = document.querySelectorAll('#userForm .is-invalid');
    invalidFields.forEach(field => {
        field.classList.remove('is-invalid');
    });
}

/**
 * Calculate age from date of birth
 */
function calculateAge() {
    const dobInput = document.getElementById("userDob");
    const ageInput = document.getElementById("userAge");
    if (!dobInput.value) { 
        ageInput.value = ""; 
        return; 
    }
    
    // Validate date first
    if (!validateDateField(dobInput)) {
        ageInput.value = "";
        return;
    }
    
    const dob = new Date(dobInput.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    ageInput.value = age;
}

/**
 * Submit new user form
 */
async function submitNewUser() {
    // Validate all fields before submission
    if (!validateAllUserFields('create')) {
        showMessage("Please correct the validation errors before submitting", "error");
        return;
    }
    
    const name = document.getElementById("newUserName").value.trim();
    const middle_name = document.getElementById("newUserMiddle").value.trim();
    const last_name = document.getElementById("newUserLast").value.trim();
    const gender = document.getElementById("userGender").value;
    const dob = document.getElementById("userDob").value;
    const age = document.getElementById("userAge").value;
    const mobile = document.getElementById("userMobile").value.trim();
    const department = document.getElementById("userDepartment").value.trim();
    const designation = document.getElementById("userDesignation").value.trim();
    const date_of_joining = document.getElementById("userDoj").value;

    const email = document.getElementById("userEmail").value.trim();
    const password = document.getElementById("userPassword").value.trim();
    const company_id = document.getElementById("userCompany").value.trim();
    const role = "user";

    // Basic validation (already done by real-time validation, but double-check)
    if (!name || !email || !password || !company_id) {
        showMessage("Please fill required fields.", "error");
        return;
    }

    const payload = {
        name, 
        middle_name: middle_name || undefined, 
        last_name: last_name || undefined, 
        gender: gender || undefined,
        dob: dob || undefined,
        age: age ? parseInt(age) : undefined,
        mobile: mobile || undefined, 
        department: department || undefined, 
        designation: designation || undefined,
        date_of_joining: date_of_joining || undefined,
        email, password, role, company_id
    };

    try {
        const res = await apiFetch(`${API_BASE_URL}/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            const userId = data.id;

            // Upload profile photo if selected
            const fileInput = document.getElementById("userProfilePhoto");
            if (fileInput.files.length > 0) {
                const formData = new FormData();
                formData.append("file", fileInput.files[0]);
                const photoRes = await apiFetch(`${API_BASE_URL}/users/${userId}/profile-photo`, {
                    method: "POST",
                    body: formData
                });
                if (!photoRes.ok) {
                    console.warn("Profile photo upload failed");
                }
            }
            showMessage("User created successfully!", "success");
            closeUserModal();
            loadDashboardData();
        } else {
            const err = await res.text();
            showMessage(err, "error");
        }
    } catch (error) {
        showMessage("Error creating user: " + error.message, "error");
    }
}

// ================================
// USER EDITING FUNCTIONS
// ================================

/**
 * Open edit user modal with pre-filled data
 */
function openEditUserModal(user) {
    document.getElementById("editUserId").value = user.id;
    document.getElementById("editUserName").value = user.name || "";
    document.getElementById("editUserEmail").value = user.email || "";
    document.getElementById("editUserPassword").value = "";
    document.getElementById("editUserRole").value = user.role || "";

    const companySelect = document.getElementById("editUserCompany");
    companySelect.innerHTML = '<option value="">Choose One</option>';
    companies.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id; 
        opt.textContent = c.name;
        companySelect.appendChild(opt);
    });
    
    if (user.company_id) {
        companySelect.value = user.company_id;
    }
    
    // Setup validation after modal is shown
    setTimeout(() => {
        setupUserRealTimeValidation();
    }, 100);
    
    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
}

/**
 * Close edit user modal
 */
function closeEditUserModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    modal.hide();
    document.getElementById("editUserForm").reset();
    
    // Reset validation states
    const invalidFields = document.querySelectorAll('#editUserForm .is-invalid');
    invalidFields.forEach(field => {
        field.classList.remove('is-invalid');
    });
}

/**
 * Handle edit user form submission
 */
document.getElementById("editUserForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    // Validate all fields before submission
    if (!validateAllUserFields('edit')) {
        showMessage("Please correct the validation errors before submitting", "error");
        return;
    }
    
    const id = document.getElementById("editUserId").value;
    const payload = {};
    const n = document.getElementById("editUserName").value.trim();
    const em = document.getElementById("editUserEmail").value.trim();
    const pw = document.getElementById("editUserPassword").value.trim();
    const rl = document.getElementById("editUserRole").value.trim();
    const co = document.getElementById("editUserCompany").value.trim();
    
    if (n) payload.name = n;
    if (em) payload.email = em;
    if (pw) payload.password = pw;
    if (rl) payload.role = rl;
    if (co) payload.company_id = co;
    
    if (Object.keys(payload).length === 0) {
        showMessage("Nothing to update", "error");
        return;
    }
    
    try {
        const res = await apiFetch(`${API_BASE_URL}/users/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            showMessage("User updated successfully", "success");
            closeEditUserModal();
            loadUsers();
        } else {
            const t = await res.text();
            showMessage(t || "Failed to update user", "error");
        }
    } catch (error) {
        showMessage("Error updating user: " + error.message, "error");
    }
});

// Initialize validation when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupUserRealTimeValidation();
});

// ================================
// USER STATUS MANAGEMENT
// ================================

/**
 * Confirm user status change with reason
 */
function confirmUserStatusChange(userId, newStatus, dropdown) {
    const statusText = newStatus === 'active' ? 'Active' : 'Inactive';
    
    // Show custom confirmation modal with reason input
    showStatusChangeModal(userId, newStatus, statusText, dropdown);
}

/**
 * Show status change confirmation modal
 */
function showStatusChangeModal(userId, newStatus, statusText, dropdown) {
    const modalHtml = `
        <div class="modal fade" id="statusChangeModal" tabindex="-1" aria-labelledby="statusChangeModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header ${newStatus === 'active' ? 'bg-success' : 'bg-danger'} text-white">
                        <h5 class="modal-title" id="statusChangeModalLabel">Confirm Status Change</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to change this user's status to <strong>${statusText}</strong>?</p>
                        <div class="mb-3">
                            <label for="statusReasonInput" class="form-label">Reason for status change <span class="text-danger">*</span></label>
                            <textarea class="form-control" id="statusReasonInput" rows="3" placeholder="Enter reason for status change..." required></textarea>
                            <div class="invalid-feedback">Please provide a reason for the status change.</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn ${newStatus === 'active' ? 'btn-success' : 'btn-danger'}" onclick="proceedUserStatusChange('${userId}', '${newStatus}', this)">
                            Confirm Change
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM if it doesn't exist
    if (!document.getElementById('statusChangeModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        // Update existing modal
        document.getElementById('statusChangeModal').outerHTML = modalHtml;
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('statusChangeModal'));
    modal.show();
    
    // Store dropdown reference for later use
    document.getElementById('statusChangeModal').dataset.dropdownId = dropdown.getAttribute('data-user-id');
}

/**
 * Proceed with user status change
 */
async function proceedUserStatusChange(userId, status, button) {
    const reasonInput = document.getElementById('statusReasonInput');
    const reason = reasonInput.value.trim();
    
    // Validate reason
    if (!reason) {
        reasonInput.classList.add('is-invalid');
        return;
    }
    
    reasonInput.classList.remove('is-invalid');
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/users/${userId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify({ 
                status: status,
                reason: reason 
            })
        });

        if (response.ok) {
            showMessage(`User status updated to ${status}`, "success");
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('statusChangeModal'));
            modal.hide();
            
            // Update the dropdown's current status attribute
            const dropdown = document.querySelector(`.status-dropdown[data-user-id="${userId}"]`);
            if (dropdown) {
                dropdown.setAttribute('data-current-status', status);
            }
            
            loadDashboardData();
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to update user status", "error");
            
            // Reset dropdown on error
            const dropdown = document.querySelector(`.status-dropdown[data-user-id="${userId}"]`);
            if (dropdown) {
                const currentStatus = dropdown.getAttribute('data-current-status');
                dropdown.value = currentStatus;
            }
            
            button.disabled = false;
            button.innerHTML = 'Confirm Change';
        }
    } catch (error) {
        showMessage("Error updating user status", "error");
        
        // Reset dropdown on error
        const dropdown = document.querySelector(`.status-dropdown[data-user-id="${userId}"]`);
        if (dropdown) {
            const currentStatus = dropdown.getAttribute('data-current-status');
            dropdown.value = currentStatus;
        }
        
        button.disabled = false;
        button.innerHTML = 'Confirm Change';
    }
}

// ================================
// DELETE CONFIRMATION FUNCTIONS
// ================================

/**
 * Confirm and delete company
 */
async function confirmDeleteCompany(id) {
    if (!confirm("Delete this company? This cannot be undone.")) return;
    const res = await apiFetch(`${API_BASE_URL}/companies/${id}`, {
        method: "DELETE",
        headers: { "X-User-Role": "super_admin" }
    });
    if (res.ok) {
        showMessage("Company deleted", "success");
        loadCompanies();
        loadCompaniesForSelect();
    } else {
        const t = await res.text();
        showMessage(t || "Failed to delete company", "error");
    }
}

/**
 * Confirm and delete user
 */
async function confirmDeleteUser(id) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await apiFetch(`${API_BASE_URL}/users/${id}`, {
        method: "DELETE",
        headers: { "X-User-Role": "super_admin" }
    });
    if (res.ok) {
        showMessage("User deleted", "success");
        loadUsers();
    } else {
        const t = await res.text();
        showMessage(t || "Failed to delete user", "error");
    }
}

// ================================
// RESTORE DELETED ITEMS FUNCTIONS
// ================================

/**
 * Show restore menu for deleted items
 */
function showRestoreMenu() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('restore');
    document.getElementById('dataTitle').textContent = 'Restore Deleted Items';
    document.getElementById('dataFilterDropdown').style.display = 'none';
    document.getElementById('statusFilter').style.display = 'none';
    
    const content = document.getElementById("dataContent");
    content.innerHTML = `
        <div class="restore-section">
            
            <p class="text-muted">Select the type of items you want to restore</p>
            
            <ul class="nav nav-tabs" id="restoreTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="companies-tab" data-bs-toggle="tab" data-bs-target="#companies-tab-pane" type="button" role="tab" aria-controls="companies-tab-pane" aria-selected="true" onclick="loadDeletedCompanies()">
                        <i class="fas fa-building"></i> Companies
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-tab-pane" type="button" role="tab" aria-controls="users-tab-pane" aria-selected="false" onclick="loadDeletedUsers()">
                        <i class="fas fa-users"></i> Users
                    </button>
                </li>
            </ul>
            
            <div class="tab-content" id="restoreTabContent">
                <div class="tab-pane fade show active" id="companies-tab-pane" role="tabpanel" aria-labelledby="companies-tab" tabindex="0">
                    <div id="deletedCompaniesContent" class="py-3">
                        <p class="text-muted text-center">Loading deleted companies...</p>
                    </div>
                </div>
                <div class="tab-pane fade" id="users-tab-pane" role="tabpanel" aria-labelledby="users-tab" tabindex="0">
                    <div id="deletedUsersContent" class="py-3">
                        <p class="text-muted text-center">Loading deleted users...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load deleted companies by default
    loadDeletedCompanies();
}

/**
 * Load deleted companies
 */
async function loadDeletedCompanies() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/deleted/companies`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const deletedCompanies = await response.json();
            displayDeletedCompanies(deletedCompanies);
        }
    } catch (error) {
        document.getElementById("deletedCompaniesContent").innerHTML = `
            <div class="alert alert-danger">Error loading deleted companies: ${error.message}</div>
        `;
    }
}

/**
 * Load deleted users
 */
async function loadDeletedUsers() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/deleted/users`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const deletedUsers = await response.json();
            displayDeletedUsers(deletedUsers);
        }
    } catch (error) {
        document.getElementById("deletedUsersContent").innerHTML = `
            <div class="alert alert-danger">Error loading deleted users: ${error.message}</div>
        `;
    }
}

/**
 * Display deleted companies
 */
function displayDeletedCompanies(companies) {
    const content = document.getElementById("deletedCompaniesContent");
    if (companies.length === 0) {
        content.innerHTML = `<p class="text-muted text-center py-4">No deleted companies found</p>`;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table">
                <thead>
                    <tr>
                        <th>Company Name</th>
                        <th>Description</th>
                        <th>Address</th>
                        <th>Deleted At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    companies.forEach(company => {
        html += `
            <tr>
                <td>${company.name}</td>
                <td>${company.description || '-'}</td>
                <td>${company.address || '-'}</td>
                <td>${company.deleted_at ? new Date(company.deleted_at).toLocaleDateString() : 'Unknown'}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick='restoreCompany("${company.id}")'>
                        <i class="fas fa-trash-restore"></i> Restore
                    </button>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;
}

/**
 * Display deleted users
 */
function displayDeletedUsers(users) {
    const content = document.getElementById("deletedUsersContent");
    if (users.length === 0) {
        content.innerHTML = `<p class="text-muted text-center py-4">No deleted users found</p>`;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Company</th>
                        <th>Deleted At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach(user => {
        const company = companies.find(c => c.id === user.company_id);
        const badgeClass = user.role === 'company_admin' ? 'badge-admin' : 'badge-user';
        
        html += `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="badge ${badgeClass}">${user.role}</span></td>
                <td>${company ? company.name : 'Unknown'}</td>
                <td>${user.deleted_at ? new Date(user.deleted_at).toLocaleDateString() : 'Unknown'}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick='restoreUser("${user.id}")'>
                        <i class="fas fa-trash-restore"></i> Restore
                    </button>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;
}

/**
 * Restore deleted company
 */
async function restoreCompany(companyId) {
    if (!confirm("Are you sure you want to restore this company?")) return;
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/restore`, {
            method: "POST",
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            showMessage("Company restored successfully", "success");
            loadDeletedCompanies();
            loadDashboardData();
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to restore company", "error");
        }
    } catch (error) {
        showMessage("Error restoring company", "error");
    }
}

/**
 * Restore deleted user
 */
async function restoreUser(userId) {
    if (!confirm("Are you sure you want to restore this user?")) return;
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/users/${userId}/restore`, {
            method: "POST",
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            showMessage("User restored successfully", "success");
            loadDeletedUsers();
            loadDashboardData();
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to restore user", "error");
        }
    } catch (error) {
        showMessage("Error restoring user", "error");
    }
}

// ================================
// REPORTS & USAGE STATISTICS
// ================================

/**
 * Show usage reports
 */
function showReports() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('reports');
    document.getElementById('dataTitle').textContent = 'Usage Reports';
    document.getElementById('dataFilterDropdown').style.display = 'none';
    document.getElementById('statusFilter').style.display = 'none';
    document.getElementById('companyFilter').style.display = 'none';
    document.getElementById('roleFilter').style.display = 'none';
    
    const content = document.getElementById("dataContent");
    content.innerHTML = `
        <div class="card">
            
            <div class="card-body">
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="d-flex align-items-center">
                            <label for="monthPicker" class="form-label fw-bold me-3 mb-0">Select Month:</label>
                            <input type="month" id="monthPicker" class="form-control" style="width: 200px;">
                        </div>
                    </div>
                </div>
                <div id="usageReportContainer" class="table-responsive"></div>
            </div>
        </div>
    `;
    
    // Set current month and load report
    const currentMonth = new Date().toISOString().slice(0, 7);
    document.getElementById("monthPicker").value = currentMonth;
    loadUsageReport(currentMonth);
    
    document.getElementById("monthPicker").addEventListener("change", (e) => {
        loadUsageReport(e.target.value);
    });
}

/**
 * Load usage report for selected month
 */
async function loadUsageReport(selectedMonth = null) {
    const container = document.getElementById("usageReportContainer");
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading usage report...</p>
        </div>
    `;

    try {
        const monthParam = selectedMonth ? `?month=${selectedMonth}` : "";
        const response = await apiFetch(`${API_BASE_URL}/companies/usage-report${monthParam}`, {
            headers: { "X-User-Role": "super_admin" }
        });

        if (!response.ok) throw new Error("Failed to fetch report");
        const data = await response.json();

        let tableHtml = `
            <table class="table table-striped table-hover" id="usageReportTable">
                <thead class="table-light">
                    <tr>
                        <th>S.No</th>
                        <th>Company Name</th>
                        <th>Page Limit</th>
                        <th>Used Pages</th>
                        <th>Remaining Pages</th>
                        <th>Pages Usage %</th>
                        <th>Total Amount Paid (₹)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.report.forEach((item, index) => {
            const usagePercentage = parseFloat(item.usage_percentage);
            let usageBadge = "bg-success";
            if (usagePercentage >= 75) usageBadge = "bg-warning";
            if (usagePercentage >= 90) usageBadge = "bg-danger";

            tableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.company_name}</td>
                    <td>${item.monthly_limit.toLocaleString()}</td>
                    <td>${item.current_usage.toLocaleString()}</td>
                    <td>${item.remaining_pages.toLocaleString()}</td>
                    <td><span class="badge ${usageBadge}">${item.usage_percentage}%</span></td>
                    <td>
                        <a href="javascript:void(0);" 
                           
                           onclick='openAmountHistoryModal("${item.company_id}", ${JSON.stringify(item.history || [])})'
                           title="View Payment History">
                            ₹${item.total_paid.toLocaleString()}
                        </a>
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;

        // Reinitialize DataTable
        if ($.fn.DataTable.isDataTable('#usageReportTable')) {
            $('#usageReportTable').DataTable().destroy();
        }

        $('#usageReportTable').DataTable({
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            language: { lengthMenu: "_MENU_" },
            order: [],
            columnDefs: [
                { orderable: true, targets: [0, 1, 2, 3, 4, 5, 6] },
                { orderable: false, targets: '_all' },
                { width: "120px", targets: "_all" }
            ],
            dom: `
                <"d-flex justify-content-between align-items-center mb-3"
                    <"d-flex" lB>
                    f
                >
                rt
                <"d-flex justify-content-between align-items-center mt-3"
                    i
                    p
                >
            `,
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: '<i class="fa fa-file-excel text-success"></i>',
                    filename: (() => {
                        const today = new Date();
                        const d = String(today.getDate()).padStart(2, '0');
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const y = today.getFullYear();
                        return `Usage_Report_${d}-${m}-${y}`;
                    })(),
                    title: 'Usage Report',
                    sheetName: 'Usage Report',
                    exportOptions: {
                        format: {
                            body: data => data.replace(/<[^>]*>/g, '') // strip HTML tags
                        }
                    }
                },
                {
                    extend: 'pdfHtml5',
                    text: '<i class="fa fa-file-pdf text-danger"></i>',
                    title: (() => {
                        const today = new Date();
                        const d = String(today.getDate()).padStart(2, '0');
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const y = today.getFullYear();
                        return `Usage_Report_${d}-${m}-${y}`;
                    })(),
                    orientation: 'landscape',
                    pageSize: 'A3',
                    exportOptions: { columns: [0,1,2,3,4,5,6] },
                    customize: function (doc) {
                        doc.styles.tableHeader = {
                            fillColor: '#f2f2f2',
                            color: 'black',
                            alignment: 'left',
                            bold: true
                        };
                        doc.defaultStyle.fontSize = 8;

                        // Set column widths
                        doc.content[1].table.widths = [
                            '5%', '25%', '12%', '12%', '12%', '10%', '12%'
                        ];

                        // Layout and border customization
                        doc.content[1].layout = {
                            hLineWidth: i => (i === 1 ? 2 : 0.5),
                            vLineWidth: () => 0.5,
                            hLineColor: () => 'black',
                            vLineColor: () => 'black',
                            paddingLeft: () => 4,
                            paddingRight: () => 4,
                            paddingTop: () => 2,
                            paddingBottom: () => 2
                        };

                        // Align numeric columns to center/right
                        const body = doc.content[1].table.body;
                        for (let i = 1; i < body.length; i++) {
                            body[i][0].alignment = 'center';
                            body[i][2].alignment = 'right';
                            body[i][3].alignment = 'right';
                            body[i][4].alignment = 'right';
                            body[i][5].alignment = 'center';
                            body[i][6].alignment = 'right';
                        }

                        // Page margins and footer
                        doc.pageMargins = [20, 20, 20, 30];
                        doc['footer'] = (currentPage, pageCount) => ({
                            text: `${currentPage} / ${pageCount}`,
                            alignment: 'right',
                            margin: [0, 0, 20, 0]
                        });
                    }
                },
                {
                    extend: 'print',
                    text: '<i class="fa fa-print text-primary"></i>',
                    title: (() => {
                        const today = new Date();
                        const d = String(today.getDate()).padStart(2, '0');
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const y = today.getFullYear();
                        return `Usage_Report_${d}-${m}-${y}`;
                    })(),
                    exportOptions: {
                        format: {
                            body: data => data.replace(/<[^>]*>/g, '') // strip HTML
                        }
                    }
                }
            ]
        });

    } catch (err) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading usage report: ${err.message}
            </div>
        `;
    }
}

/**
 * Open payment history modal
 */
function openAmountHistoryModal(companyId, history) {
    const modalId = "amountHistoryModal";

    // Create modal HTML if not exists
    if (!document.getElementById(modalId)) {
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title">Payment History</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="amountHistoryBody">
                            <p class="text-center py-4">Loading payment history...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const body = document.getElementById("amountHistoryBody");

    if (!history || history.length === 0) {
        body.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                <p class="text-muted">No payment history found for this month.</p>
            </div>
        `;
    } else {
        let table = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>Date</th>
                            <th>Amount Paid (₹)</th>
                            <th>Pages Added</th>
                            <th>Updated By</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        history.forEach(h => {
            const updatedAt = new Date(h.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const updatedBy = h.updated_by?.role || "System";
            
            table += `
                <tr>
                    <td>${updatedAt}</td>
                    <td class="fw-bold text-success">₹${h.amount_paid?.toLocaleString() || 0}</td>
                    <td>${h.added_limit || 0}</td>
                    <td><span class="badge bg-primary">${updatedBy}</span></td>
                </tr>
            `;
        });
        
        table += `</tbody></table></div>`;
        body.innerHTML = table;
    }

    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}


// ================================
// BANK MANAGEMENT FUNCTIONS
// ================================

/**
 * Load and display banks
 */
async function loadBanks() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('banks');
    document.getElementById('dataTitle').textContent = '';
    
    // Hide filter elements
    document.getElementById('dataFilterDropdown').style.display = 'none';
    document.getElementById('statusFilter').style.display = 'none';
    
    try {
        const url = `${API_BASE_URL}/banks`;
        
        const response = await apiFetch(url, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const banks = await response.json();
            displayBanks(banks);
        }
    } catch (error) {
        showMessage("Error loading banks", "error");
    }
}

/**
 * Display banks in a table
 */
function displayBanks(banks) {
    const content = document.getElementById("dataContent");
    
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Banks</h5>
            <button class="btn btn-primary" onclick="openBankModal()">
                <i class="fas fa-plus"></i> Add New Bank
            </button>
        </div>
    `;
    
    if (banks.length === 0) {
        html += `<p class="text-muted text-center py-4">No banks found</p>`;
        content.innerHTML = html;
        return;
    }

    html += `
        <div class="table-responsive">
            <table class="table data-table table-striped table-hover" id="banksTable">
                <thead class="table-light">
                    <tr>
                        <th>S.No</th>
                        <th>Bank Name</th>
                        <th>Short Name</th>
                        <th>IFSC Prefix</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    banks.forEach((bank, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${bank.bank_name}</td>
                <td>${bank.short_name}</td>
                <td>${bank.ifsc_prefix}</td>
                <td>
                    <select class="form-select form-select-sm status-dropdown" data-bank-id="${bank.id}" data-current-status="${bank.status || 'active'}">
                        <option value="active" ${(bank.status || 'active') === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${(bank.status || 'active') === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </td>
               
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick='openEditBankModal(${JSON.stringify(bank)})'>
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;
    
    // Initialize DataTable
    if ($.fn.DataTable.isDataTable('#banksTable')) {
        $('#banksTable').DataTable().destroy();
    }
    
    const table = $('#banksTable').DataTable({
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[1, 'asc']], // Order by Bank Name instead of S.No
        language: {
            search: "Search banks:",
            lengthMenu: "Show _MENU_ banks per page",
            info: "Showing _START_ to _END_ of _TOTAL_ banks",
            infoEmpty: "No banks available",
            infoFiltered: "(filtered from _MAX_ total banks)"
        }
    });
    
    // Add event listeners for status dropdowns
    // Use event delegation for DataTables
    $('#banksTable').on('change', '.status-dropdown', function () {
        const bankId = $(this).data('bank-id');
        const currentStatus = $(this).data('current-status');
        const newStatus = $(this).val();

        if (currentStatus !== newStatus) {
            confirmBankStatusChange(bankId, newStatus, this);
        }
    });

}

/**
 * Confirm bank status change
 */
function confirmBankStatusChange(bankId, newStatus, dropdown) {
    const statusText = newStatus === 'active' ? 'Active' : 'Inactive';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} this bank?`)) {
        updateBankStatus(bankId, newStatus, dropdown);
    } else {
        // Reset dropdown to original value
        const currentStatus = dropdown.getAttribute('data-current-status');
        dropdown.value = currentStatus;
    }
}

/**
 * Update bank status via API
 */
async function updateBankStatus(bankId, status, dropdown) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks/${bankId}/status?status=${status}`, {
            method: "PATCH",
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const statusText = status === 'active' ? 'Active' : 'Inactive';
            showMessage(`Bank status updated to ${statusText}`, "success");
            // Update the current status attribute
            dropdown.setAttribute('data-current-status', status);
            loadDashboardData();
        } else {
            const errorText = await response.text();
            showMessage(errorText || `Failed to update bank status`, "error");
            // Reset dropdown on error
            const currentStatus = dropdown.getAttribute('data-current-status');
            dropdown.value = currentStatus;
        }
    } catch (error) {
        showMessage(`Error updating bank status`, "error");
        // Reset dropdown on error
        const currentStatus = dropdown.getAttribute('data-current-status');
        dropdown.value = currentStatus;
    }
}

/**
 * Open bank creation modal
 */
function openBankModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('bankModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
        <div class="modal fade" id="bankModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">Add New Bank</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="bankForm" novalidate>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">Bank Information</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <label for="bankName" class="form-label">Bank Name <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="bankName" required>
                                                <div class="invalid-feedback">Please provide a bank name.</div>
                                            </div>
                                            <div class="mb-3">
                                                <label for="shortName" class="form-label">Short Name <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="shortName" required>
                                                <div class="invalid-feedback">Please provide a short name.</div>
                                            </div>
                                            <div class="mb-3">
                                                <label for="ifscPrefix" class="form-label">IFSC Prefix <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="ifscPrefix" 
                                                    pattern="[A-Z]{4}" 
                                                    title="4 uppercase letters" 
                                                    maxlength="4"
                                                    oninput="this.value = this.value.toUpperCase()"
                                                    required>
                                                <div class="form-text">4 uppercase letters (e.g., SBIN, HDFC)</div>
                                                <div class="invalid-feedback">Please provide a valid 4-character IFSC prefix.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card h-100">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">Instructions</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="alert alert-info">
                                                <small>
                                                    <i class="fas fa-info-circle me-2"></i>
                                                    <strong>Bank Name:</strong> Full legal name of the bank<br><br>
                                                    <strong>Short Name:</strong> Abbreviated name for display<br><br>
                                                    <strong>IFSC Prefix:</strong> First 4 characters of IFSC code (e.g., SBIN for State Bank of India)
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Bank</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = new bootstrap.Modal(document.getElementById('bankModal'));
    modal.show();
    
    // Add form submit event listener
    document.getElementById('bankForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createBank();
    });
    
    // Focus on the first input field when modal opens
    setTimeout(() => {
        document.getElementById('bankName')?.focus();
    }, 500);
}

/**
 * Create new bank
 */
async function createBank() {
    const modal = document.getElementById('bankModal');
    if (!modal) {
        showMessage("Bank modal not found", "error");
        return;
    }
    
    const form = document.getElementById('bankForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }
    
    const bankName = modal.querySelector("#bankName")?.value.trim() || "";
    const shortName = modal.querySelector("#shortName")?.value.trim() || "";
    const ifscPrefix = modal.querySelector("#ifscPrefix")?.value.trim() || "";
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify({
                bank_name: bankName,
                short_name: shortName,
                ifsc_prefix: ifscPrefix
            })
        });
        
        if (response.ok) {
            showMessage("Bank created successfully", "success");
            const bsModal = bootstrap.Modal.getInstance(document.getElementById('bankModal'));
            bsModal.hide();
            loadBanks(currentStatusFilter);
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to create bank", "error");
        }
    } catch (error) {
        showMessage("Error creating bank: " + error.message, "error");
    }
}

/**
 * Open edit bank modal
 */
function openEditBankModal(bank) {
    // Remove existing modal if any
    const existingModal = document.getElementById('editBankModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
        <div class="modal fade" id="editBankModal" tabindex="-1" aria-labelledby="editBankModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="editBankModalLabel">Edit Bank</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="editBankForm" novalidate>
                        <input type="hidden" id="editBankId" value="${bank.id}">
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-12">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">Bank Information</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <label for="editBankName" class="form-label">Bank Name <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="editBankName" value="${bank.bank_name}" required>
                                                <div class="invalid-feedback">Please provide a bank name.</div>
                                            </div>
                                            <div class="mb-3">
                                                <label for="editShortName" class="form-label">Short Name <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="editShortName" value="${bank.short_name}" required>
                                                <div class="invalid-feedback">Please provide a short name.</div>
                                            </div>
                                            <div class="mb-3">
                                                <label for="editIfscPrefix" class="form-label">IFSC Prefix <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control" id="editIfscPrefix" 
                                                    value="${bank.ifsc_prefix}"
                                                    pattern="[A-Z]{4}" 
                                                    title="4 uppercase letters" 
                                                    maxlength="4"
                                                    oninput="this.value = this.value.toUpperCase()"
                                                    required>
                                                <div class="form-text">4 uppercase letters (e.g., SBIN, HDFC)</div>
                                                <div class="invalid-feedback">Please provide a valid 4-character IFSC prefix.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = new bootstrap.Modal(document.getElementById('editBankModal'));
    modal.show();
    
    // Add form submit event listener
    document.getElementById('editBankForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateBank();
    });
    
    // Focus on the first input field when modal opens
    setTimeout(() => {
        document.getElementById('editBankName')?.focus();
    }, 500);
}

/**
 * Update bank details
 */
async function updateBank() {
    const modal = document.getElementById('editBankModal');
    if (!modal) {
        showMessage("Edit bank modal not found", "error");
        return;
    }
    
    const form = document.getElementById('editBankForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }
    
    const bankId = modal.querySelector("#editBankId")?.value || "";
    const bankName = modal.querySelector("#editBankName")?.value.trim() || "";
    const shortName = modal.querySelector("#editShortName")?.value.trim() || "";
    const ifscPrefix = modal.querySelector("#editIfscPrefix")?.value.trim() || "";
    
    if (!bankId) {
        showMessage("Bank ID not found", "error");
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks/${bankId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "super_admin"
            },
            body: JSON.stringify({
                bank_name: bankName,
                short_name: shortName,
                ifsc_prefix: ifscPrefix
            })
        });
        
        if (response.ok) {
            showMessage("Bank updated successfully", "success");
            const bsModal = bootstrap.Modal.getInstance(document.getElementById('editBankModal'));
            bsModal.hide();
            loadBanks(currentStatusFilter);
        } else {
            const errorText = await response.text();
            showMessage(errorText || "Failed to update bank", "error");
        }
    } catch (error) {
        showMessage("Error updating bank", "error");
    }
}

// ================================
// SETTINGS & UTILITY FUNCTIONS
// ================================

/**
 * Show settings menu
 */
function showSettings() {
    document.getElementById('statsCards').style.display = 'none';
    updateActiveNavLink('settings');
    document.getElementById('dataTitle').textContent = 'Settings';
    document.getElementById('dataFilterDropdown').style.display = 'none';
    document.getElementById('statusFilter').style.display = 'none';
    document.getElementById('companyFilter').style.display = 'none';
    document.getElementById('roleFilter').style.display = 'none';
    const content = document.getElementById("dataContent");
    content.innerHTML = `
        <div class="row">
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card settings-card card-primary text-white" onclick="showRestoreMenu()">
                    <div class="card-body">
                        <i class="fas fa-trash-restore card-icon"></i>
                        <h5 class="card-title">Restore</h5>
                        <p class="card-text">Restore deleted companies and users</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card settings-card card-success text-white" onclick="openCompanyModal()">
                    <div class="card-body">
                        <i class="fas fa-plus-circle card-icon"></i>
                        <h5 class="card-title">Add Company</h5>
                        <p class="card-text">Create a new company</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card settings-card card-warning text-white" onclick="openUserModal()">
                    <div class="card-body">
                        <i class="fas fa-user-plus card-icon"></i>
                        <h5 class="card-title">Add User</h5>
                        <p class="card-text">Create a new user</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card settings-card card-info text-white" onclick="loadBanks()">
                    <div class="card-body">
                        <i class="fas fa-university card-icon"></i>
                        <h5 class="card-title">Bank Management</h5>
                        <p class="card-text">Manage bank details</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Filter data by status
 */
function filterByStatus(status) {
    currentStatusFilter = status;
    
    // Update button states
    document.querySelectorAll('#statusFilter .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#statusFilter .btn:nth-child(${status === 'all' ? 1 : status === 'active' ? 2 : 3})`).classList.add('active');
    
    // Reload data based on current page
    const currentPage = localStorage.getItem('currentPage');
    if (currentPage === 'companies') {
        loadCompanies(status);
    } else if (currentPage === 'users') {
        loadUsers(status);
    }
}

// ================================
// API KEY MANAGEMENT FUNCTIONS
// ================================

/**
 * View API keys status for a company
 */
async function viewApiKeys() {
    const companyId = document.getElementById("editCompanyId").value;
    if (!companyId) {
        showMessage("No company selected", "error");
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/api-keys`, {
            headers: {
                "X-User-Role": "super_admin"
            }
        });
        
        if (response.ok) {
            const apiKeys = await response.json();
            showMessage(
                `API Keys Status for ${apiKeys.company_name}:<br>` +
                `- Gemini Key: ${apiKeys.has_gemini_key ? 'Set' : 'Not Set'}<br>` +
                `- Llama Key: ${apiKeys.has_llama_key ? 'Set' : 'Not Set'}<br>` +
                `- Model: ${apiKeys.gemini_model}`,
                "info"
            );
        } else {
            showMessage("Failed to fetch API keys status", "error");
        }
    } catch (error) {
        showMessage("Error fetching API keys status", "error");
    }
}

/**
 * Clear API keys for a company
 */
async function clearApiKeys() {
    const companyId = document.getElementById("editCompanyId").value;
    if (!companyId) {
        showMessage("No company selected", "error");
        return;
    }

    if (!confirm("Are you sure you want to clear all API keys for this company?")) return;

    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/api-keys`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-User-Role": "super_admin"
            },
            body: "gemini_api_key=&llama_api_key="
        });
        
        if (response.ok) {
            showMessage("API keys cleared successfully", "success");
        } else {
            showMessage("Failed to clear API keys", "error");
        }
    } catch (error) {
        showMessage("Error clearing API keys", "error");
    }
}

// ================================
// FILE UPLOAD FUNCTIONS
// ================================

/**
 * Upload company logo
 */
async function uploadCompanyLogo(companyId) {
    const logoFile = document.getElementById("companyLogo")?.files[0] || 
                    document.getElementById("editCompanyLogo")?.files[0];
    
    if (!logoFile) return;
    
    const formData = new FormData();
    formData.append("logo", logoFile);
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/logo`, {
            method: "POST",
            headers: {
                "X-User-Role": "super_admin"
            },
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            return result;
        } else {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to upload logo");
        }
    } catch (error) {
        console.error("Error uploading logo:", error);
        throw error;
    }
}

/**
 * Handle logo preview
 */
function handleLogoPreview(e, imgId, previewId) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 1024 * 1024) {
            showMessage("File size must be less than 1MB", "error");
            e.target.value = "";
            return;
        }
        
        if (!file.type.match("image/jpeg|image/png|image/gif")) {
            showMessage("Only JPEG, PNG and GIF images are allowed", "error");
            e.target.value = "";
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(imgId).src = e.target.result;
            document.getElementById(previewId).style.display = "block";
        }
        reader.readAsDataURL(file);
    }
}

// ================================
// NOTIFICATION & UI UTILITIES
// ================================

/**
 * Show message/notification
 */
function showMessage(message, type) {
    const alertBox = document.createElement('div');
    alertBox.style.position = 'fixed';
    alertBox.style.top = '20px';
    alertBox.style.right = '20px';
    alertBox.style.padding = '15px';
    alertBox.style.borderRadius = '5px';
    alertBox.style.color = 'white';
    alertBox.style.zIndex = '9999';
    alertBox.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    alertBox.style.animation = 'fadeIn 0.3s ease-out';
    
    if (type === "error") {
        alertBox.style.backgroundColor = '#dc3545';
    } else {
        alertBox.style.backgroundColor = '#28a745';
    }
    
    alertBox.textContent = type === "error" ? `Error: ${message}` : message;
    document.body.appendChild(alertBox);
    
    setTimeout(() => {
        alertBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(alertBox);
        }, 300);
    }, 2000);
}

// ================================
// INITIALIZATION
// ================================

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    setActiveNavLink();
    
    // Logo preview for create form
    document.getElementById("companyLogo")?.addEventListener("change", function(e) {
        handleLogoPreview(e, "logoPreviewImg", "logoPreview");
    });
    
    // Logo preview for edit form
    document.getElementById("editCompanyLogo")?.addEventListener("change", function(e) {
        handleLogoPreview(e, "editLogoPreviewImg", "editLogoPreview");
    });
    
    // Navigation link click handlers
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            if (page) {
                updateActiveNavLink(page);
            }
        });
    });
});