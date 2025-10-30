const API_BASE_URL = 'http://127.0.0.1:8000';
        const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB in bytes
        const ALLOWED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        // --- Validation Helpers ---
        function capitalizeWords(str) {
            return str.replace(/\b\w/g, c => c.toUpperCase());
        }

        function isAlpha(str) {
            return /^[A-Za-z\s]+$/.test(str);
        }

        function isAlphanumeric(str) {
            return /^[A-Za-z0-9\s]+$/.test(str);
        }

        function isValidWebsite(url) {
            return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[^\s]*)?$/.test(url);
        }

        function isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        function isValidMobile(num) {
            return /^[0-9]{10}$/.test(num);
        }

        function isValidGST(gst) {
            return /^[0-9]{2}$/.test(gst);
        }

        function isValidPincode(pin) {
            return /^[1-9][0-9]{5}$/.test(pin);
        }

        function isValidAccountNumber(num) {
            return /^[0-9]{9,18}$/.test(num);
        }

        let userData = null;
        let companyData = null;
        let analysisHistory = [];
        function updateSidebarLogo() {
            const sidebarLogo = document.getElementById('sidebarCompanyLogo');
            
            if (companyData && companyData.logo_url) {
                // Use the company logo from the API
                sidebarLogo.src = `${API_BASE_URL}${companyData.logo_url}`;
            } else {
                // Fallback to the default logo if no company logo exists
                sidebarLogo.src = "static/logo3.png";
            }
            
            // Add error handling in case the logo fails to load
            sidebarLogo.onerror = function() {
                this.src = "static/logo3.png";
            };
        }
        // Check authentication on page load
        window.onload = function() {
            const storedUserData = localStorage.getItem("userData");
            
            if (!storedUserData) {
                window.location.href = "/ui";
                return;
            }

            userData = JSON.parse(storedUserData);
            if (userData.role !== "company_admin") {
                window.location.href = "/ui";
                return;
            }

            document.getElementById("userName").textContent = userData.name;
            document.getElementById("userInitial").textContent = userData.name.charAt(0).toUpperCase();
            
            loadCompanyData();
            
            loadAnalysisHistory();
            setActiveLink('dashboard');
            updateDashboardStats();
            showDashboard();
        };
        function updateStatsLabels() {
            const now = new Date();
            const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

            const month = monthNames[now.getMonth()]; // Get short month name
            const year = now.getFullYear();

            const formattedMonthYear = `${month} ${year}`;

            document.getElementById('analysesLabel').innerText = `Analyzed Resumes - ${formattedMonthYear}`;
            document.getElementById('pagesLabel').innerText = `Parsed Pages - ${formattedMonthYear}`;
        }

        // Call this function when the page loads or when data is refreshed
        updateStatsLabels();

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

        function setActiveLink(linkId) {
            // Remove active class from all links
            document.querySelectorAll('#sidebar .nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            // Add active class to the clicked link
            if (linkId) {
                const activeLink = document.querySelector(`#sidebar .nav-link[data-link="${linkId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
            
            // Store the active link in localStorage
            localStorage.setItem('activeLink', linkId || 'dashboard');
        }

        // Function to update dashboard stats
async function updateDashboardStats() {
    try {
        // Ensure analysisHistory is loaded
        if (!analysisHistory || analysisHistory.length === 0) {
            await loadAnalysisHistory();
        }

        // Active users
        const usersResponse = await apiFetch(`${API_BASE_URL}/users?company_id=${userData.company_id}`);
        if (usersResponse.ok) {
            const users = await usersResponse.json();
            const activeUsers = users.filter(user => user.status === "active" && user.role === "user");

            const usersEl = document.getElementById("activeUsersCount");
            if (usersEl) usersEl.textContent = activeUsers.length;
        }

        // Monthly pages and analyses
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyPages = analysisHistory
            .filter(a => a.timestamp && new Date(a.timestamp).getMonth() === currentMonth && new Date(a.timestamp).getFullYear() === currentYear)
            .reduce((sum, a) => sum + (a.page_count || 0), 0);

        const monthlyPagesEl = document.getElementById("monthlyPagesCount");
        if (monthlyPagesEl) monthlyPagesEl.textContent = monthlyPages;

        const monthlyAnalyses = analysisHistory
            .filter(a => a.timestamp && new Date(a.timestamp).getMonth() === currentMonth && new Date(a.timestamp).getFullYear() === currentYear);

        const monthlyAnalysesEl = document.getElementById("monthlyAnalysesCount");
        if (monthlyAnalysesEl) monthlyAnalysesEl.textContent = monthlyAnalyses.length;

    } catch (error) {
        console.error("Error updating dashboard stats:", error);
    }
}

        function showDashboard() {
    setActiveLink('dashboard');
    document.getElementById('dataSectionTitle').textContent = 'Company Data';
    document.getElementById('dataFilterDropdownContainer').style.display = 'block';
    
    // Show the stats cards
    document.getElementById('dashboardStats').style.display = 'flex';
    
    // Get current date for default values
    const now = new Date();
    const currentYear = now.getFullYear();
    
    document.getElementById('dataContent').innerHTML = `
        <div class="form-section">
            <div class="form-section-title d-flex justify-content-between align-items-center">
                <div>
                    
                </div>
                <div class="d-flex align-items-center gap-2" style="font-size: 0.9rem;">
                    <div>
                        <label class="mb-0 me-1">View:</label>
                        <select id="chartFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" onchange="updateDashboardChart()">
                            <option value="all">All</option>
                            <option value="admin">Admin</option>
                            <option value="user">Users</option>
                            <option value="individual">Admin and Users</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-0 me-1">Year:</label>
                        <select id="chartYear" class="form-control form-control-sm d-inline-block" style="width: 80px;" onchange="updateDashboardChart()">
                            ${generateYearOptions(currentYear)}
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="chart-container mt-3" style="position: relative; height:400px; width:100%">
                <canvas id="pagesChart"></canvas>
            </div>
        </div>
    `;
    
    // Initialize the chart
    setTimeout(() => {
        updateDashboardChart();
    }, 100);
}

function generateYearOptions(currentYear) {
    let options = '';
    for (let year = currentYear - 2; year <= currentYear; year++) {
        options += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
    }
    return options;
}

let pagesChart = null;

async function updateDashboardChart() {
    const filterType = document.getElementById('chartFilter').value;
    const selectedYear = parseInt(document.getElementById('chartYear').value);
    
    try {
        // Get active users
        const usersResponse = await apiFetch(`${API_BASE_URL}/users?company_id=${userData.company_id}&status=active`);
        if (!usersResponse.ok) return;
        
        const users = await usersResponse.json();
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYearNow = currentDate.getFullYear();
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const labels = [];
        const monthCount = selectedYear === currentYearNow ? currentMonth + 1 : 12;
        
        for (let i = 0; i < monthCount; i++) {
            labels.push(`${monthNames[i]} ${selectedYear}`);
        }
        
        const datasets = [];
        
        // Common color palette
        const colorPalette = [
            'rgba(54, 162, 235, 0.7)',  // Blue
            'rgba(255, 99, 132, 0.7)',  // Red
            'rgba(75, 192, 192, 0.7)',  // Teal
            'rgba(255, 159, 64, 0.7)',  // Orange
            'rgba(153, 102, 255, 0.7)', // Purple
            'rgba(255, 205, 86, 0.7)',  // Yellow
            'rgba(201, 203, 207, 0.7)', // Gray
            'rgba(0, 128, 128, 0.7)',   // Teal
            'rgba(128, 0, 128, 0.7)',   // Purple
            'rgba(128, 128, 0, 0.7)'    // Olive
        ];

        if (filterType === 'individual') {
            // Admin + Users shown separately
            const activeUsers = users.filter(user => user.status === "active");
            
            activeUsers.forEach((user, index) => {
                const userData = [];
                
                for (let month = 0; month < monthCount; month++) {
                    const userPages = analysisHistory
                        .filter(analysis => {
                            if (!analysis.timestamp) return false;
                            const analysisDate = new Date(analysis.timestamp);
                            return analysisDate.getMonth() === month && 
                                   analysisDate.getFullYear() === selectedYear;
                        })
                        .filter(analysis => analysis.created_by === user.id)
                        .reduce((sum, analysis) => sum + (analysis.page_count || 0), 0);
                    
                    userData.push(userPages);
                }
                
                const colorIndex = index % colorPalette.length;
                datasets.push({
                    label: `${user.name} (${user.role === 'company_admin' ? 'Admin' : 'User'})`,
                    data: userData,
                    backgroundColor: colorPalette[colorIndex],
                    borderColor: colorPalette[colorIndex].replace('0.7', '1'),
                    borderWidth: 1,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                });
            });
        } 
        else if (filterType === 'user') {
            // Each user separately (exclude admins)
            const activeUsers = users.filter(user => user.role === "user" && user.status === "active");
            
            activeUsers.forEach((user, index) => {
                const userDataPoints = [];
                
                for (let month = 0; month < monthCount; month++) {
                    const userPages = analysisHistory
                        .filter(analysis => {
                            if (!analysis.timestamp) return false;
                            const analysisDate = new Date(analysis.timestamp);
                            return analysisDate.getMonth() === month && 
                                   analysisDate.getFullYear() === selectedYear;
                        })
                        .filter(analysis => analysis.created_by === user.id)
                        .reduce((sum, analysis) => sum + (analysis.page_count || 0), 0);
                    
                    userDataPoints.push(userPages);
                }
                
                const colorIndex = index % colorPalette.length;
                datasets.push({
                    label: `${user.name} (User)`,
                    data: userDataPoints,
                    backgroundColor: colorPalette[colorIndex],
                    borderColor: colorPalette[colorIndex].replace('0.7', '1'),
                    borderWidth: 1,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                });
            });
        } 
        else {
            // Admin total
            if (filterType === 'all' || filterType === 'admin') {
                const adminData = [];
                
                for (let month = 0; month < monthCount; month++) {
                    const adminPages = users
                        .filter(user => user.role === "company_admin" && user.status === "active")
                        .reduce((total, user) => {
                            return total + analysisHistory
                                .filter(analysis => {
                                    if (!analysis.timestamp) return false;
                                    const analysisDate = new Date(analysis.timestamp);
                                    return analysisDate.getMonth() === month && 
                                           analysisDate.getFullYear() === selectedYear;
                                })
                                .filter(analysis => analysis.created_by === user.id)
                                .reduce((sum, analysis) => sum + (analysis.page_count || 0), 0);
                        }, 0);
                    
                    adminData.push(adminPages);
                }
                
                datasets.push({
                    label: 'Admin (Total)',
                    data: adminData,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                });
            }
            
            // Users total (only for "all")
            if (filterType === 'all') {
                const userData = [];
                
                for (let month = 0; month < monthCount; month++) {
                    const userPages = users
                        .filter(user => user.role === "user" && user.status === "active")
                        .reduce((total, user) => {
                            return total + analysisHistory
                                .filter(analysis => {
                                    if (!analysis.timestamp) return false;
                                    const analysisDate = new Date(analysis.timestamp);
                                    return analysisDate.getMonth() === month && 
                                           analysisDate.getFullYear() === selectedYear;
                                })
                                .filter(analysis => analysis.created_by === user.id)
                                .reduce((sum, analysis) => sum + (analysis.page_count || 0), 0);
                        }, 0);
                    
                    userData.push(userPages);
                }
                
                datasets.push({
                    label: 'Users (Total)',
                    data: userData,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                });
            }
        }
        
        // Render chart
        const ctx = document.getElementById('pagesChart').getContext('2d');
        
        if (pagesChart) {
            pagesChart.destroy();
        }
        
        pagesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Pages'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Months'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Pages Parsed in ${selectedYear}`
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating chart:', error);
    }
}


        function showResumeAnalyzer() {
            document.getElementById('dashboardStats').style.display = 'none';
            setActiveLink('resume-analyzer');
            document.getElementById('dataSectionTitle').textContent = 'Resume Analyzer';
            document.getElementById('dataFilterDropdownContainer').style.display = 'none';
            
            document.getElementById('dataContent').innerHTML = `
    <div class="form-section upload-section">
        <div class="upload-container">
            <!-- Left: Upload Box -->
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <div class="drag-drop">Drag & drop or click</div>
                <div class="hint">PDF, DOC, DOCX (Max: 1MB)</div>
                <input type="file" id="resume" accept=".pdf,.doc,.docx" style="display: none;" />
            </div>

            <!-- Right: File Info -->
            <div class="file-info">
                <div id="file-name" class="file-name"></div>
                <div id="file-error" class="file-error"></div>
            </div>
        </div>
    </div>
                <div class="form-section">
                    <div class="form-section-title">
                        <i class="fas fa-briefcase me-2"></i>Job Description Details
                    </div>
                    
                    <div class="row">
                        <label>Client</label>
                        <div class="radio-group">
                            <label><input type="radio" name="client_mode" value="new" checked onchange="toggleClientMode()" /> New Client</label>
                            <label><input type="radio" name="client_mode" value="existing" onchange="toggleClientMode()" /> Existing Client</label>
                        </div>
                    </div>

                    <div id="existing-client" class="section hidden">
                        <div class="row required">
                            <label>Select Client</label>
                            <select id="existing_client_select" onchange="loadClientJDs()">
                                <option value="">Loading clients...</option>
                            </select>
                        </div>
                        <div class="row required" id="jd_select_row" style="display: none;">
                            <label>Select Job Description</label>
                            <select id="jd_select" onchange="loadJDDetails()" disabled>
                                <option value="">Select a client first</option>
                            </select>
                        </div>
                        <div id="jd_details" class="jd-details hidden">
                            
                            <div class="row required">
                                <label>Required Experience</label>
                                <input id="jd_req_exp" type="text" disabled />
                            </div>
                            <div class="row required">
                                <label>Primary Skills (Must Have)</label>
                                <textarea id="jd_primary" disabled></textarea>
                            </div>
                            <div class="row">
                                <label>Secondary Skills (Nice to Have)</label>
                                <textarea id="jd_secondary" disabled></textarea>
                            </div>
                            <div class="jd-controls">
                                <button id="jd_edit_btn" class="secondary" onclick="enableJDEditing()">✏️ Edit</button>
                                <button id="jd_save_btn" class="primary hidden" onclick="saveJDChanges()">Save</button>
                                <button id="jd_cancel_btn" class="secondary hidden" onclick="cancelJDEditing()">Cancel</button>
                            </div>
                        </div>
                    </div>

                    <div id="new-client" class="section">
                <div class="row required"><label>Client Name</label><input type="text" id="client_name" placeholder="Zoho" /></div>
                <div class="row required"><label>Job Description Name</label><input type="text" id="jd_title" placeholder="Senior Python Developer" /></div>
                <div class="row required"><label>Required Experience</label><input type="text" id="required_experience" placeholder="e.g., 3-5, 4+, 5 +" /></div>
                <div class="row required"><label>Primary Skills (Must Have)</label><textarea id="primary_skills" placeholder="Python, Java, SQL"></textarea></div>
                <div class="row"><label>Secondary Skills (Nice to Have)</label><textarea id="secondary_skills" placeholder="Docker, AWS, CI/CD"></textarea></div>
                
                <!-- NEW FIELDS -->
                <div class="row required"><label>Location</label><input type="text" id="location" placeholder="e.g., Chennai, Trichy" /></div>
                <div class="row required"><label>Budget</label><input type="text" id="budget" placeholder="e.g., 3 LPA" /></div>
                <div class="row"><label>Number of Positions</label><input type="number" id="number_of_positions" placeholder="e.g., 2" min="1" /></div>
                <div class="row">
                    <label>Work Mode</label>
                    <select id="work_mode">
                        <option value="">Select Work Mode</option>
                        <option value="in-office">In-Office</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                    </select>
                </div>
            </div>
                </div>

                <div class="center">
                    <button id="analyze_btn" class="primary" onclick="analyzeResume()">
                        <i class="fas fa-magic me-2"></i> Analyze Resume
                    </button>
                </div>

                <div class="loading" id="analyzeLoading">
                    <div class="loading-spinner"></div>
                    <p>Analyzing resume, please wait...</p>
                </div>

                <div id="analysis_container" class="analysis hidden"></div>
            `;
            
            // Initialize the resume analyzer components
            setTimeout(() => {
                initDragAndDrop();
                initFileUpload();
                loadClients();
                initClientNameValidation();
                initJDTitleValidation();
                initRequiredExpValidation();
                initPrimarySkillsValidation();
            }, 100);
        }
       
        // Store original values for cancel functionality
        let originalJDValues = {};

        function enableJDEditing() {
            const jdReqExp = document.getElementById('jd_req_exp');
            const jdPrimary = document.getElementById('jd_primary');
            const jdSecondary = document.getElementById('jd_secondary');
            const jdEditBtn = document.getElementById('jd_edit_btn');
            const jdSaveBtn = document.getElementById('jd_save_btn');
            const jdCancelBtn = document.getElementById('jd_cancel_btn');
            const analyzeBtn = document.getElementById('analyze_btn');
            
            // Store original values
            originalJDValues = {
                req_exp: jdReqExp.value,
                primary: jdPrimary.value,
                secondary: jdSecondary.value
            };
            
            // Enable editing
            jdReqExp.disabled = false;
            jdPrimary.disabled = false;
            jdSecondary.disabled = false;
            
            // Toggle button visibility
            jdEditBtn.classList.add('hidden');
            jdSaveBtn.classList.remove('hidden');
            jdCancelBtn.classList.remove('hidden');
            
            // Hide analyze button during editing
            analyzeBtn.style.display = 'none';
        }

        function cancelJDEditing() {
            const jdReqExp = document.getElementById('jd_req_exp');
            const jdPrimary = document.getElementById('jd_primary');
            const jdSecondary = document.getElementById('jd_secondary');
            const jdEditBtn = document.getElementById('jd_edit_btn');
            const jdSaveBtn = document.getElementById('jd_save_btn');
            const jdCancelBtn = document.getElementById('jd_cancel_btn');
            const analyzeBtn = document.getElementById('analyze_btn');
            
            // Restore original values
            jdReqExp.value = originalJDValues.req_exp;
            jdPrimary.value = originalJDValues.primary;
            jdSecondary.value = originalJDValues.secondary;
            
            // Disable editing
            jdReqExp.disabled = true;
            jdPrimary.disabled = true;
            jdSecondary.disabled = true;
            
            // Toggle button visibility
            jdEditBtn.classList.remove('hidden');
            jdSaveBtn.classList.add('hidden');
            jdCancelBtn.classList.add('hidden');
            
            // Show analyze button again
            analyzeBtn.style.display = 'block';
        }

        async function saveJDChanges() {
            const clientSelect = document.getElementById('existing_client_select');
            const jdSelect = document.getElementById('jd_select');
            const jdReqExp = document.getElementById('jd_req_exp');
            const jdPrimary = document.getElementById('jd_primary');
            const jdSecondary = document.getElementById('jd_secondary');
            const jdEditBtn = document.getElementById('jd_edit_btn');
            const jdSaveBtn = document.getElementById('jd_save_btn');
            const jdCancelBtn = document.getElementById('jd_cancel_btn');
            const analyzeBtn = document.getElementById('analyze_btn');
            
            const clientName = clientSelect.value;
            const jdName = jdSelect.value;
            
            if (!clientName || !jdName) {
                alert('Please select both a client and a job description.');
                return;
            }
            
            // Validate experience format
            if (!/^\d+\s*\+|\d+\s*-\s*\d+$/.test(jdReqExp.value.trim())) {
                alert("Invalid experience format! Use '3-5', '4+' or '5 +'");
                return;
            }
            
            const body = {
                required_experience: jdReqExp.value.trim(),
                primary_skills: jdPrimary.value.split(',').map(s => s.trim()).filter(Boolean),
                secondary_skills: jdSecondary.value.split(',').map(s => s.trim()).filter(Boolean)
            };
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients/${encodeURIComponent(clientName)}/jds/${encodeURIComponent(jdName)}`, {
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(body)
                });
                
                if (res.ok) {
                    alert('Job description updated successfully!');
                    
                    // Disable editing after save
                    jdReqExp.disabled = true;
                    jdPrimary.disabled = true;
                    jdSecondary.disabled = true;
                    
                    // Toggle button visibility
                    jdEditBtn.classList.remove('hidden');
                    jdSaveBtn.classList.add('hidden');
                    jdCancelBtn.classList.add('hidden');
                    
                    // Show analyze button again
                    analyzeBtn.style.display = 'block';
                } else {
                    const error = await res.json();
                    alert(`Failed to update job description: ${error.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error updating JD:', error);
                alert('Error updating job description. Please try again.');
            }
        }

        function showAnalysisHistory() {
            document.getElementById('dashboardStats').style.display = 'none';
            setActiveLink('analysis-history');
            document.getElementById('dataSectionTitle').textContent = 'Analysis History';
            document.getElementById('dataFilterDropdownContainer').style.display = 'none';

            document.getElementById('dataContent').innerHTML = `
                <div class="form-section">
                    <div class="search-row">
                        
                        
                        <div class="filter-container">
                            <select id="user_filter" onchange="filterHistory()">
                                <option value="all">All </option>
                            </select>
                        </div>
                    </div>
                    <div id="history_table" class="table"></div>
                </div>
            `;

            // Load history data and populate user filter
            loadHistory();
            populateUserFilter();
        }
        async function populateUserFilter() {
            try {
                const response = await apiFetch(`${API_BASE_URL}/users?company_id=${userData.company_id}`);
                
                if (response.ok) {
                    const users = await response.json();
                    const userFilter = document.getElementById('user_filter');
                    userFilter.innerHTML = ""; // Clear old options

                    // 🔹 Add "All" option
                    const allOption = document.createElement('option');
                    allOption.value = 'all';
                    allOption.textContent = 'All';
                    userFilter.appendChild(allOption);

                    // 🔹 Add company admins
                    users.forEach(adminUser => {
                        if (adminUser.role === "company_admin") {
                            const adminOption = document.createElement('option');
                            adminOption.value = adminUser.id;   // ✅ use actual admin ID
                            adminOption.textContent = adminUser.name + " (Admin)";
                            userFilter.appendChild(adminOption);
                        }
                    });

                    // 🔹 Add regular users
                    users.forEach(user => {
                        if (user.role === "user") {
                            const option = document.createElement('option');
                            option.value = user.id;
                            option.textContent = user.name + " (User)";
                            userFilter.appendChild(option);
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading users for filter:', error);
            }
        }
        function report() {
         document.getElementById('dashboardStats').style.display = 'none';
    setActiveLink('report');
    document.getElementById('dataSectionTitle').textContent = 'Analysis Report';
    document.getElementById('dataFilterDropdownContainer').style.display = 'none';

    document.getElementById('dataContent').innerHTML = `
        <div class="form-section">
            <div class="filter-toolbar d-flex flex-wrap gap-2 mb-3" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">

                <!-- Multi User Filter -->
                <div style="min-width: 200px;">
                    <label class="small mb-1">Users</label>
                    <select id="user_filter" class="form-control form-control-sm" multiple></select>
                    </select>
                </div>

                <!-- Client Filter -->
                <div style="min-width: 150px;">
                    <label class="small mb-1">Client</label>
                    <select id="client_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Clients</option>
                    </select>
                </div>

                <!-- JD Filter -->
                <div style="min-width: 150px;">
                    <label class="small mb-1">Job Description</label>
                    <select id="jd_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Job Descriptions</option>
                    </select>
                </div>

                <!-- Experience Match -->
                <div style="min-width: 150px;">
                    <label class="small mb-1">Experience Match</label>
                    <select id="exp_match_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All</option>
                        <option value="true">Matched</option>
                        <option value="false">Unmatched</option>
                    </select>
                </div>

                <!-- Score Range -->
                <div style="min-width: 150px;">
                    <label class="small mb-1">Score Range</label>
                    <select id="score_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Scores</option>
                        <option value="0-50">0 - 50</option>
                        <option value="51-70">51 - 70</option>
                        <option value="71-100">71 - 100</option>
                    </select>
                </div>

                <!-- Date Range -->
                <div style="min-width: 150px;">
                    <label class="small mb-1">From Date</label>
                    <input type="date" id="from_date" class="form-control form-control-sm" onchange="filterHistory_report()">
                </div>
                
                <div style="min-width: 150px;">
                    <label class="small mb-1">To Date</label>
                    <input type="date" id="to_date" class="form-control form-control-sm" onchange="filterHistory_report()">
                </div>
            </div>

            <div id="history_table" class="table"></div>
        </div>
    `;

    // Load data
    loadHistory_report();
    populateUserFilter_report();
    populateClientAndJDFilters();
}

async function loadHistory_report() {
    const historyTable = document.getElementById('history_table');
    if (!historyTable) return;

    historyTable.innerHTML = '<div class="text-center p-4">Loading history...</div>';

    try {
        let items = [...analysisHistory]; // clone

        // 🔹 Get filters
        const selectedUserIds = Array.from(document.getElementById('user_filter')?.selectedOptions || []).map(opt => opt.value);
        const clientFilter = document.getElementById('client_filter')?.value || 'all';
        const jdFilter = document.getElementById('jd_filter')?.value || 'all';
        const expMatchFilter = document.getElementById('exp_match_filter')?.value || 'all';
        const scoreFilter = document.getElementById('score_filter')?.value || 'all';
        const fromDate = document.getElementById('from_date')?.value;
        const toDate = document.getElementById('to_date')?.value;

        // 🔹 Apply filters
        if (selectedUserIds.length > 0 && !selectedUserIds.includes('all')) {
            items = items.filter(x => selectedUserIds.includes(x.created_by));
        }
        if (clientFilter !== 'all') {
            items = items.filter(x => x.client_name === clientFilter);
        }
        if (jdFilter !== 'all') {
            items = items.filter(x => x.jd_title === jdFilter);
        }
        if (expMatchFilter !== 'all') {
            const isMatch = expMatchFilter === 'true';
            items = items.filter(x => !!x.experience_match === isMatch);
        }
        if (scoreFilter !== 'all') {
            const [min, max] = scoreFilter.split('-').map(Number);
            items = items.filter(x => {
                const score = Number(x.match_score || 0);
                return score >= min && score <= max;
            });
        }
        if (fromDate) {
            const from = new Date(fromDate);
            items = items.filter(x => new Date(x.timestamp) >= from);
        }
        if (toDate) {
            const to = new Date(toDate);
            items = items.filter(x => new Date(x.timestamp) <= to);
        }

        // 🔹 Sort newest first
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (items.length === 0) {
            historyTable.innerHTML = '<div class="text-center p-4">No analysis history found</div>';
            return;
        }

        // Check if multi-user selected → add User Name column
        const showUserName = selectedUserIds.length > 1 || selectedUserIds.includes('all');

        // 🔹 Build table rows
        const rows = items.map((h, idx) => {
            // Find user name from user data
            let userName = 'N/A';
            if (h.created_by) {
                const userSelect = document.getElementById('user_filter');
                if (userSelect) {
                    const userOption = Array.from(userSelect.options).find(opt => opt.value === h.created_by);
                    if (userOption) {
                        // Remove the role indicator from the name
                        userName = userOption.textContent.replace(/\s*\(Admin\)|\s*\(User\)/, '');
                    }
                }
            }
            
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${h.candidate_name || 'N/A'}</td>
                    <td>${h.candidate_email || 'N/A'}</td>
                    <td>${h.candidate_mobile || 'N/A'}</td>
                    <td>${h.client_name || 'N/A'}</td>
                    <td>${h.jd_title || 'N/A'}</td>
                    <td>${h.required_experience || 'N/A'} Years</td>
                    <td>${h.total_experience || 'N/A'}</td>
                    <td style="text-align: center;">${h.experience_match ? '✅' : '❌'}</td>
                    <td style="text-align: center;">${h.frequent_hopper ? '✅' : '❌'}</td>
                    <td>${h.match_score ?? 'N/A'}</td>
                    ${showUserName ? `<td>${userName}</td>` : ""}
                    <td>${h.filename || 'N/A'}</td>
                    <td>${h.page_count || 'N/A'}</td>
                    <td>${formatDate(h.timestamp)}</td>
                    
                </tr>
            `;
        }).join('');

        // 🔹 Render table
        historyTable.innerHTML = `
            <div class="table-responsive">
                <table id="historyTable" class="table table-striped table-bordered">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Candidate Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Client</th>
                            <th>Job Description</th>
                            <th>Required <br> Experience</th>
                            <th>Candidate <br> Experience</th>
                            <th>Experience <br> Match</th>
                            <th>Frequent <br> Hopper</th>
                            <th>Score</th>
                            ${showUserName ? `<th>User Name</th>` : ""}
                            <th>File Name</th>
                            <th>Parsed <br> Pages</th>
                            <th>Parsed Date</th>
                         
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        // 🔹 Initialize DataTable
        const exportFileName = `Analysis_Report_${formatDate(new Date(), 'dd-mm-yyyy')}`;

        $('#historyTable').DataTable({
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            language: { lengthMenu: "_MENU_" },
            order: [],
            columnDefs: [
                { orderable: true, targets: [0, 1, 9, 11, 12] }, // Adjust indices for new column
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
                    filename: exportFileName,
                    title: exportFileName,
                    sheetName: 'Analysis Report',
                    exportOptions: {
                        columns: ':visible', // include all visible columns
                        format: {
                            body: function (data, row, column, node) {
                                if (typeof data === 'string') {
                                    if (data.includes('✅')) return 'Yes';
                                    if (data.includes('❌')) return 'No';
                                }
                                if (data === true || data === 1) return 'Yes';
                                if (data === false || data === 0 || data === null || data === undefined) return 'No';
                                return data;
                            }
                        }
                    }
                },
                {
                    extend: 'pdfHtml5',
                    text: '<i class="fa fa-file-pdf text-danger"></i>',
                    title: exportFileName,
                    orientation: 'landscape',
                    pageSize: 'A3',
                    exportOptions: { columns: ':visible' },
                    customize: function (doc) {
                        doc.styles.tableHeader = {
                            fillColor: '#f2f2f2',
                            color: 'black',
                            alignment: 'left',
                            bold: true
                        };
                        doc.defaultStyle.fontSize = 8;

                        // ✅ Convert all checkmarks/cross to Yes/No in PDF
                        doc.content[1].table.body.forEach((row, i) => {
                            if (i === 0) return; // skip header row
                            row.forEach((cell, j) => {
                                if (cell.text) {
                                    let t = cell.text.toString();
                                    if (t.includes('✅')) cell.text = 'Yes';
                                    else if (t.includes('❌')) cell.text = 'No';
                                    else if (t === 'true') cell.text = 'Yes';
                                    else if (t === 'false') cell.text = 'No';
                                    else if (t === '0') cell.text = 'No';
                                    else if (t === '1') cell.text = 'Yes';
                                }
                            });
                        });

                        // table layout and footer
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

                        doc.pageMargins = [20, 20, 20, 30];
                        doc['footer'] = (currentPage, pageCount) => ({
                            text: currentPage.toString() + ' / ' + pageCount,
                            alignment: 'right',
                            margin: [0, 0, 20, 0]
                        });
                    }
                },
                {
                    extend: 'print',
                    text: '<i class="fa fa-print text-primary"></i>',
                    title: exportFileName,
                    exportOptions: {
                        columns: ':visible',
                        format: {
                            body: function (data, row, column, node) {
                                if (typeof data === 'string') {
                                    if (data.includes('✅')) return 'Yes';
                                    if (data.includes('❌')) return 'No';
                                }
                                if (data === true || data === 1) return 'Yes';
                                if (data === false || data === 0 || data === null || data === undefined) return 'No';
                                return data;
                            }
                        }
                    }
                }
            ]
        });
    } catch (e) {
        console.error('Error loading history:', e);
        historyTable.innerHTML = '<div class="alert alert-danger">Failed to load history</div>';
    }
}
function formatDate(date, format = 'dd-mm-yyyy') {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

async function populateUserFilter_report() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/users?company_id=${userData.company_id}`);
        if (response.ok) {
            const users = await response.json();
            const userFilter = document.getElementById('user_filter');
            userFilter.innerHTML = "";

            // Add All Users option
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = 'All Users';
            userFilter.appendChild(allOption);

            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = u.name + (u.role === "company_admin" ? " (Admin)" : " (User)");
                userFilter.appendChild(opt);
            });

            // Initialize Choices
            if (window.userChoices) {
                window.userChoices.destroy();
            }
            window.userChoices = new Choices('#user_filter', {
                removeItemButton: true,
                searchEnabled: true,
                placeholderValue: 'Select users...',
                noResultsText: 'No users found',
                itemSelectText: '',
                shouldSort: false
            });

            // Enforce mutually exclusive logic
            userFilter.addEventListener('change', () => {
                const selected = Array.from(userFilter.selectedOptions).map(opt => opt.value);
                if (selected.includes('all') && selected.length > 1) {
                    // If 'all' is selected, unselect other options
                    window.userChoices.removeActiveItems();
                    window.userChoices.setChoiceByValue('all');
                }
                filterHistory_report();
            });
        }
    } catch (err) {
        console.error("Error loading users:", err);
    }
}



function populateClientAndJDFilters() {
    const clientFilter = document.getElementById('client_filter');
    const jdFilter = document.getElementById('jd_filter');

    const clients = [...new Set(analysisHistory.map(x => x.client_name).filter(Boolean))];
    const jds = [...new Set(analysisHistory.map(x => x.jd_title).filter(Boolean))];

    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        clientFilter.appendChild(opt);
    });

    jds.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j;
        opt.textContent = j;
        jdFilter.appendChild(opt);
    });
}


        function initDragAndDrop() {
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('resume');
            
            if (!uploadArea || !fileInput) return;
            
            // Click to select files
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            // Highlight drop area when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, unhighlight, false);
            });
            
            // Handle dropped files
            uploadArea.addEventListener('drop', handleDrop, false);
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            function highlight() {
                uploadArea.classList.add('drag-over');
            }
            
            function unhighlight() {
                uploadArea.classList.remove('drag-over');
            }
            
            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length) {
                    handleFiles(files);
                }
            }
        }

        function initFileUpload() {
            const fileInput = document.getElementById('resume');
            
            if (!fileInput) return;
            
            fileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    handleFiles(this.files);
                }
            });
        }

        function handleFiles(files) {
            const file = files[0];
            const fileError = document.getElementById('file-error');
            const fileNameBox = document.getElementById('file-name');
            
            // Validate file
            const validationResult = validateFile(file);
            if (!validationResult.isValid) {
                fileError.textContent = validationResult.message;
                fileError.style.display = 'block';
                fileNameBox.innerHTML = '';
                return;
            }
            
            // Hide any previous error
            fileError.style.display = 'none';
            
            // Update file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('resume').files = dataTransfer.files;
            
            // Show file name + remove icon
            fileNameBox.innerHTML = `
                <span class="file-label">📄 ${file.name}</span>
                <span class="remove-file" onclick="removeSelectedFile()">✖</span>
            `;
        }

        function removeSelectedFile() {
            const fileInput = document.getElementById('resume');
            fileInput.value = "";
            document.getElementById('file-name').innerHTML = "";
            document.getElementById('file-error').style.display = "none";
        }

        function validateFile(file) {
            // Check if file is provided
            if (!file) {
                return { isValid: false, message: 'Please select a file.' };
            }
            
            // Check file type
            if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                return { isValid: false, message: 'Invalid file type. Please upload a PDF, DOC, or DOCX file.' };
            }
            
            // Check file size
            if (file.size > MAX_FILE_SIZE) {
                return { isValid: false, message: 'File size exceeds the 1MB limit.' };
            }
            
            return { isValid: true, message: '' };
        }

        function toggleClientMode() {
            const usingExisting = document.querySelector('input[name="client_mode"][value="existing"]').checked;
            document.getElementById('existing-client').classList.toggle('hidden', !usingExisting);
            document.getElementById('new-client').classList.toggle('hidden', usingExisting);
        }

        async function loadClients() {
            const clientSelect = document.getElementById('existing_client_select');
            const jdSelectRow = document.getElementById('jd_select_row');
            
            if (!clientSelect) return;
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients/table-data`);
                const clients = await res.json();
                
                clientSelect.innerHTML = '<option value="">Choose a Client</option>';
                clients.forEach(client => {
                    // Only show active clients
                    if (client.status === 'active') {
                        clientSelect.innerHTML += `<option value="${client.name}">${client.name}</option>`;
                    }
                });
                
            } catch (error) {
                console.error('Error loading clients:', error);
                clientSelect.innerHTML = '<option value="">Error loading clients</option>';
            }
        }

        async function loadClientJDs() {
            const clientSelect = document.getElementById('existing_client_select');
            const jdSelect = document.getElementById('jd_select');
            const jdSelectRow = document.getElementById('jd_select_row');
            const jdDetails = document.getElementById('jd_details');
            
            const clientName = clientSelect.value;
            
            // Hide JD selection if no client is selected
            if (!clientName) {
                jdSelectRow.style.display = 'none';
                jdDetails.classList.add('hidden');
                return;
            }
            
            // Show JD selection row
            jdSelectRow.style.display = 'flex';
            jdSelect.innerHTML = '<option value="">Loading job descriptions...</option>';
            jdSelect.disabled = true;
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients/${encodeURIComponent(clientName)}/jds`);
                const jds = await res.json();
                
                jdSelect.innerHTML = '<option value="">Choose a Job Description</option>';
                jds.forEach(jd => {
                    jdSelect.innerHTML += `<option value="${jd}">${jd}</option>`;
                });
                
                jdSelect.disabled = false;
                
            } catch (error) {
                console.error('Error loading JDs:', error);
                jdSelect.innerHTML = '<option value="">Error loading job descriptions</option>';
            }
            
            jdDetails.classList.add('hidden');
        }

        async function loadJDDetails() {
            const clientSelect = document.getElementById('existing_client_select');
            const jdSelect = document.getElementById('jd_select');
            const jdDetails = document.getElementById('jd_details');
            const jdReqExp = document.getElementById('jd_req_exp');
            const jdPrimary = document.getElementById('jd_primary');
            const jdSecondary = document.getElementById('jd_secondary');
            const jdEditBtn = document.getElementById('jd_edit_btn');
            const jdSaveBtn = document.getElementById('jd_save_btn');
            const jdCancelBtn = document.getElementById('jd_cancel_btn');
            const analyzeBtn = document.getElementById('analyze_btn');

            const clientName = clientSelect.value;
            const jdName = jdSelect.value;
            
            if (!clientName || !jdName) {
                jdDetails.classList.add('hidden');
                return;
            }
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients/${encodeURIComponent(clientName)}/jds/${encodeURIComponent(jdName)}`);
                
                if (!res.ok) {
                    jdDetails.classList.add('hidden');
                    return;
                }
                
                const data = await res.json();
                jdReqExp.value = data.required_experience || '';
                jdPrimary.value = (data.primary_skills || []).join(', ');
                jdSecondary.value = (data.secondary_skills || []).join(', ');
                
                // Ensure fields are disabled initially
                jdReqExp.disabled = true;
                jdPrimary.disabled = true;
                jdSecondary.disabled = true;
                
                // Show only Edit button initially
                jdEditBtn.classList.remove('hidden');
                jdSaveBtn.classList.add('hidden');
                jdCancelBtn.classList.add('hidden');
                
                // Show analyze button
                analyzeBtn.style.display = 'block';
                
                jdDetails.classList.remove('hidden');
                
            } catch (error) {
                console.error('Error loading JD details:', error);
                alert('Failed to load job description details');
                jdDetails.classList.add('hidden');
            }
        }

        async function loadCompanyData() {
            try {
                // Get company information
                const response = await apiFetch(`${API_BASE_URL}/companies`);
                
                if (response.ok) {
                    const companies = await response.json();
                    companyData = companies.find(c => c.id === userData.company_id);
                    updateSidebarLogo();
                }
            } catch (error) {
                console.error("Error loading company data:", error);
            }
        }

        async function loadCompanyUsers() {
    document.getElementById('dashboardStats').style.display = 'none';
    setActiveLink('users');
    document.getElementById('dataSectionTitle').textContent = 'My Users';
    document.getElementById('dataFilterDropdownContainer').style.display = 'block';
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/users?company_id=${userData.company_id}`);
        
        if (response.ok) {
            const users = await response.json();
            
            // Destroy existing DataTable if it exists
            if ($.fn.DataTable.isDataTable('#usersTable')) {
                $('#usersTable').DataTable().destroy();
            }
            
            if (analysisHistory.length === 0) {
                await loadAnalysisHistory();
            }
            displayCompanyUsers(users);
            updateUserStats(users);
        }
    } catch (error) {
        showMessage("Error loading users", "error");
    }
}

        function updateUserStats(users) {
    const activeUsers = users.filter(user => user.status === "active" && user.role === "user").length;
    const admins = users.filter(user => user.status === "active" && user.role === "company_admin").length;
    
    // These are just for internal tracking, not displayed on the dashboard
    // console.log("Active Users:", activeUsers);
    // console.log("Active Admins:", admins);
}

        function displayCompanyUsers(users) {
    const content = document.getElementById("dataContent");

    const regularUsers = users.filter(user => user.role === "user");

    if (regularUsers.length === 0) {
        content.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No regular users found in your company
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table data-table" id="usersTable">
                <thead>
                    <tr>
                        <th style="text-align:center;">S.No</th>
                        <th style="text-align:center;">Name</th>
                        <th style="text-align:center;">Email</th>
                        <th style="text-align:center;">Total Analyzed <br> Resumes</th>
                        <th style="text-align:center;">Total Parsed <br> Pages</th>
                        <th style="text-align:center;">User <br> Created On</th>
                        <th style="width: 180px; text-align:center;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    regularUsers.forEach((user, index) => {
        const userAnalyses = analysisHistory.filter(analysis => analysis.created_by === user.id);
        
        const userPages = userAnalyses.reduce((total, analysis) => total + (analysis.page_count || 0), 0);
        const userResumesCount = userAnalyses.length;

        const statusDropdown = `
            <select class="form-select form-select-sm status-dropdown ${user.status === "active" ? "bg-success-subtle text-dark" : "bg-danger-subtle text-dark"}"
                    onchange="handleStatusChange('${user.id}', this)">
                <option value="active" ${user.status === "active" ? "selected" : ""}>Active</option>
                <option value="inactive" ${user.status === "inactive" ? "selected" : ""}>Inactive</option>
            </select>
        `;

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${userResumesCount}</td>
                <td>${userPages}</td>  
                <td>${formatDate(user.created_at)}</td>
                <td class="text-center">${statusDropdown}</td>
            </tr>
        `;
    });

    html += "</tbody></table></div>";
    content.innerHTML = html;

    // Initialize DataTable for pagination
    $('#usersTable').DataTable({
        pageLength: 10,
        lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
        language: { 
            lengthMenu: "Show _MENU_ users per page",
            search: "Search users:",
            info: "Showing _START_ to _END_ of _TOTAL_ users",
            infoEmpty: "No users available",
            infoFiltered: "(filtered from _MAX_ total users)"
        },
        order: [],
        columnDefs: [
            { orderable: true, targets: [0, 1, 2, 3, 4, 5] },
            { orderable: false, targets: [6] }, // Status column not sortable
            { width: "auto", targets: "_all" }
        ],
        dom: `
            <"d-flex justify-content-between align-items-center mb-3"
                <"d-flex" l>
                f
            >
            rt
            <"d-flex justify-content-between align-items-center mt-3"
                i
                p
            >
        `,
        responsive: true
    });
}

function handleStatusChange(userId, selectEl) {
    const newStatus = selectEl.value;
    const originalStatus = newStatus === 'active' ? 'inactive' : 'active';
    
    // Immediately reset to original value
    selectEl.value = originalStatus;
    selectEl.className = `form-select form-select-sm status-dropdown ${originalStatus === 'active' ? 'bg-success-subtle text-dark' : 'bg-danger-subtle text-dark'}`;

    if (newStatus === "inactive") {
        if (!confirm(`Do you want to deactivate this user?`)) {
            return;
        }
        
        showReasonModal(userId, selectEl);
    } else if (newStatus === "active") {
        alert("Contact admin to activate this user");
    }
}

function showReasonModal(userId, selectEl) {
    const modalId = 'reasonModal';
    
    // Create modal HTML if it doesn't exist
    if (!document.getElementById(modalId)) {
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Deactivation Reason</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">
                                    Please enter a reason <span class="text-danger">*</span>
                                </label>
                                <textarea 
                                    class="form-control" 
                                    id="deactivationReason" 
                                    rows="3" 
                                    maxlength="50"
                                    placeholder="Enter reason for deactivation..."></textarea>
                                <div class="form-text text-danger" id="reasonError" style="display: none;"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger" onclick="submitDeactivation('${userId}')">Deactivate User</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Reset form
    const reasonInput = document.getElementById('deactivationReason');
    const reasonError = document.getElementById('reasonError');
    reasonInput.value = '';
    reasonError.style.display = 'none';
    reasonError.textContent = '';

    // Add validation listener (attach only once)
    if (!reasonInput.dataset.listenerAdded) {
        reasonInput.addEventListener('input', () => {
            const validPattern = /^[a-zA-Z0-9 ]*$/;
            if (!validPattern.test(reasonInput.value)) {
                reasonInput.value = reasonInput.value.replace(/[^a-zA-Z0-9 ]/g, '');
                reasonError.style.display = 'block';
                reasonError.textContent = 'Please enter only letters and numbers.';
            } else if (reasonInput.value.length > 50) {
                reasonInput.value = reasonInput.value.slice(0, 50);
                reasonError.style.display = 'block';
                reasonError.textContent = 'Maximum 50 characters allowed.';
            } else {
                reasonError.style.display = 'none';
                reasonError.textContent = '';
            }
        });
        reasonInput.dataset.listenerAdded = "true";
    }

    // Store select element for later use
    window.currentSelectEl = selectEl;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

function submitDeactivation(userId) {
    const reasonInput = document.getElementById('deactivationReason');
    const reasonError = document.getElementById('reasonError');
    const reason = reasonInput.value.trim();

    if (!reason) {
        reasonError.style.display = 'block';
        reasonError.textContent = 'Reason is required.';
        reasonInput.focus();
        return;
    }

    reasonError.style.display = 'none';

    // Update dropdown visually
    if (window.currentSelectEl) {
        window.currentSelectEl.value = "inactive";
        window.currentSelectEl.className = "form-select form-select-sm status-dropdown bg-danger-subtle text-dark";
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('reasonModal'));
    modal.hide();

    // Call API
    updateUserStatus(userId, "inactive", reason);
}

// Keep the original updateUserStatus function as you had it
async function updateUserStatus(userId, status, reason) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: status,
                reason: reason
            })
        });

        if (response.ok) {
            showMessage(`User ${status === 'active' ? 'activated' : 'deactivated'} successfully!`, 'success');
            loadCompanyUsers(); // reload list
            updateDashboardStats();
        } else {
            const error = await response.json();
            showMessage(`Failed to update user status: ${error.detail || 'Unknown error'}`, 'error');
            loadCompanyUsers(); // reload to reset UI
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        showMessage('Error updating user status. Please try again.', 'error');
        loadCompanyUsers(); // reload to reset UI
    }
}
// Show clients table
function showClientsMenu() {
    document.getElementById('dashboardStats').style.display = 'none';
    setActiveLink('clients');
    document.getElementById('dataSectionTitle').textContent = 'My Clients';
    document.getElementById('dataFilterDropdownContainer').style.display = 'none';
    
    document.getElementById('dataContent').innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                </div>
                <div>
                    <select id="statusFilter" class="form-select form-select-sm" style="width: 120px;" onchange="loadClientsTable()">
                        
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>
            <div class="card-body">
                <div id="clientsTableContainer">
                    <div class="text-center p-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading clients data...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadClientsTable();
}

// Load clients table data
async function loadClientsTable() {
    try {
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        let url = `${API_BASE_URL}/clients/table-data`;
        
        if (statusFilter) {
            url += `?status=${statusFilter}`;
        }
        
        const response = await apiFetch(url);
        if (response.ok) {
            const clients = await response.json();
            
            // Destroy existing DataTable if it exists
            if ($.fn.DataTable.isDataTable('#clientsTable')) {
                $('#clientsTable').DataTable().destroy();
            }
            
            renderClientsTable(clients);
        } else {
            throw new Error('Failed to load clients data');
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        document.getElementById('clientsTableContainer').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i> Failed to load clients data: ${error.message}
            </div>
        `;
    }
}

// Render clients table with proper Bootstrap styling
// Render clients table with proper Bootstrap styling and pagination
function renderClientsTable(clients) {
    const container = document.getElementById('clientsTableContainer');
    
    if (clients.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No clients found
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-striped table-bordered table-hover" id="clientsTable">
                <thead class="table-light">
                    <tr>
                        <th>S.No</th>
                        <th>Client Name</th>
                        <th>Job Descriptions</th>
                        <th>Client Created Date</th>
                        <th>Edit</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    clients.forEach((client, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${client.name}</td>
                <td>
                    ${client.status === 'active' ? 
                        `<button class="btn btn-sm btn-info" onclick="viewJobDescriptions('${client.id}', '${client.name}')">
                            <i class="fas fa-list me-1"></i> View JDs (${client.jd_count})
                        </button>` : 
                        '<span class="text-muted">N/A</span>'
                    }
                </td>
                <td>${formatDate(client.created_at)}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm" onclick="editClient('${client.id}', '${client.name}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
                <td>
                    <select class="form-select form-select-sm status-dropdown ${client.status === 'active' ? 'bg-success-subtle text-dark' : 'bg-danger-subtle text-dark'}"
                            onchange="toggleClientStatus('${client.id}', '${client.name}', this.value)">
                        <option value="active" ${client.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${client.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </td>
            </tr>
        `;
    });
    
    html += "</tbody></table></div>";
    container.innerHTML = html;
    
    // Initialize DataTable for pagination
    $('#clientsTable').DataTable({
        pageLength: 10,
        lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
        language: { 
            lengthMenu: "Show _MENU_ clients per page",
            search: "Search clients:",
            info: "Showing _START_ to _END_ of _TOTAL_ clients",
            infoEmpty: "No clients available",
            infoFiltered: "(filtered from _MAX_ total clients)"
        },
        order: [],
        columnDefs: [
            { orderable: true, targets: [0, 1, 2, 3] },
            { orderable: false, targets: [4, 5] }, // Edit and Status columns not sortable
            { width: "auto", targets: "_all" }
        ],
        dom: `
            <"d-flex justify-content-between align-items-center mb-3"
                <"d-flex" l>
                f
            >
            rt
            <"d-flex justify-content-between align-items-center mt-3"
                i
                p
            >
        `,
        responsive: true
    });
    updateDashboardStats();
}
// Toggle client status (activate/deactivate)
async function toggleClientStatus(clientId, clientName, newStatus) {
    const currentStatus = newStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} the client "${clientName}"?`)) {
        // Reset the dropdown to the previous value
        const dropdowns = document.querySelectorAll(`.status-dropdown`);
        dropdowns.forEach(dropdown => {
            if (dropdown.onchange.toString().includes(clientId)) {
                dropdown.value = currentStatus;
                dropdown.className = `form-select form-select-sm status-dropdown ${currentStatus === 'active' ? 'bg-success-subtle text-dark' : 'bg-secondary text-white'}`;
            }
        });
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/clients/${clientId}/status?status=${newStatus}`, {
            method: 'PATCH'
        });
        
        if (response.ok) {
            showMessage(`Client "${clientName}" has been ${action}d successfully`, 'success');
            
            // Update the dropdown appearance
            const dropdowns = document.querySelectorAll(`.status-dropdown`);
            dropdowns.forEach(dropdown => {
                if (dropdown.onchange.toString().includes(clientId)) {
                    dropdown.className = `form-select form-select-sm status-dropdown ${newStatus === 'active' ? 'bg-success-subtle text-dark' : 'bg-secondary text-white'}`;
                }
            });
            
            loadClientsTable();
        } else {
            // Reset the dropdown if the operation failed
            const dropdowns = document.querySelectorAll(`.status-dropdown`);
            dropdowns.forEach(dropdown => {
                if (dropdown.onchange.toString().includes(clientId)) {
                    dropdown.value = currentStatus;
                    dropdown.className = `form-select form-select-sm status-dropdown ${currentStatus === 'active' ? 'bg-success-subtle text-dark' : 'bg-secondary text-white'}`;
                }
            });
            
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to ${action} client`);
        }
    } catch (error) {
        console.error(`Error ${action}ing client:`, error);
        showMessage(error.message, 'error');
        
        // Reset the dropdown on error
        const dropdowns = document.querySelectorAll(`.status-dropdown`);
        dropdowns.forEach(dropdown => {
            if (dropdown.onchange.toString().includes(clientId)) {
                dropdown.value = currentStatus;
                dropdown.className = `form-select form-select-sm status-dropdown ${currentStatus === 'active' ? 'bg-success-subtle text-dark' : 'bg-secondary text-white'}`;
            }
        });
    }
}


// View job descriptions for a client
async function viewJobDescriptions(clientId, clientName) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/job-descriptions/${clientId}`);
        if (response.ok) {
            const data = await response.json();
            showJDModal(clientName, data.job_descriptions);
        } else {
            throw new Error('Failed to load job descriptions');
        }
    } catch (error) {
        console.error('Error loading job descriptions:', error);
        showMessage('Failed to load job descriptions', 'error');
    }
}

// Show JD modal with proper job description titles
// Show JD modal with proper job description titles
function showJDModal(clientName, jds) {
    let content = '';
    
    if (jds.length === 0) {
        content = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No job descriptions found for this client
            </div>
        `;
    } else {
        content = `
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>S.No</th>
                            <th>JD Title</th>
                            <th>Required <br> Experience</th>
                            <th>Primary <br> Skills</th>
                            <th>Secondary <br> Skills</th>
                            <th>Location</th>
                            <th>Budget</th>
                            <th>Number of <br> Positions</th>
                            <th>Work Mode</th>
                            <th>Edit</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        jds.forEach((jd, index) => {
            content += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${jd.title || 'Untitled'}</td>
                    <td>${jd.required_experience || 'Not specified'}</td>
                    <td>${jd.primary_skills?.join(', ') || 'None'}</td>
                    <td>${jd.secondary_skills?.join(', ') || 'None'}</td>
                    <td>${jd.location || 'Not specified'}</td>
                    <td>${jd.budget || 'Not specified'}</td>
                    <td>${jd.number_of_positions || 'Not specified'}</td>
                    <td>${jd.work_mode || 'Not specified'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="editJobDescription('${jd.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        content += `</tbody></table></div>`;
    }
    
    // Create Bootstrap modal
    const modalId = 'jdModal';
    if (!document.getElementById(modalId)) {
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Job Descriptions - ${clientName}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="${modalId}Body">
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } else {
        document.getElementById(`${modalId}Body`).innerHTML = content;
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

// Edit client
function editClient(clientId, clientName) {
    const modalId = 'editClientModal';
    const content = `
        <div class="mb-3">
            <label for="editClientName" class="form-label">Client Name</label>
            <input type="text" class="form-control" id="editClientName" value="${clientName}">
        </div>
    `;
    
    if (!document.getElementById(modalId)) {
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Client</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="${modalId}Body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            
                            <button type="button" class="btn btn-primary" onclick="saveClientChanges('${clientId}')">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } else {
        document.getElementById(`${modalId}Body`).innerHTML = content;
        document.getElementById('editClientName').value = clientName;
    }
    
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

// Save client changes
async function saveClientChanges(clientId) {
    const newName = document.getElementById('editClientName').value.trim();
    
    if (!newName) {
        showMessage('Client name cannot be empty', 'error');
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (response.ok) {
            showMessage('Client updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editClientModal')).hide();
            loadClientsTable();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update client');
        }
    } catch (error) {
        console.error('Error updating client:', error);
        showMessage(error.message, 'error');
    }
}

// Delete client
// async function deleteClient(clientId, clientName) {
//     if (!confirm(`Are you sure you want to delete the client "${clientName}"? This will also delete all associated job descriptions.`)) {
//         return;
//     }
    
//     try {
//         const response = await apiFetch(`${API_BASE_URL}/clients/${clientId}`, {
//             method: 'DELETE'
//         });
        
//         if (response.ok) {
//             showMessage('Client deleted successfully', 'success');
//             loadClientsTable();
//         } else {
//             const errorData = await response.json();
//             throw new Error(errorData.detail || 'Failed to delete client');
//         }
//     } catch (error) {
//         console.error('Error deleting client:', error);
//         showMessage(error.message, 'error');
//     }
// }

// Edit job description
async function editJobDescription(jdId) {
    try {
        const modalBody = document.getElementById('jdModalBody');
        const jdRows = modalBody.querySelectorAll('tbody tr');
        let jdData = null;

        for (const row of jdRows) {
            const actionBtn = row.querySelector('button.btn-outline-primary');
            if (actionBtn && actionBtn.onclick.toString().includes(jdId)) {
                const cells = row.querySelectorAll('td');
                jdData = {
                    id: jdId,
                    title: cells[1].textContent.trim(),
                    required_experience: cells[2].textContent.trim(),
                    primary_skills: cells[3].textContent.split(',').map(s => s.trim()),
                    secondary_skills: cells[4].textContent.split(',').map(s => s.trim()),
                    location: cells[5].textContent.trim(),
                    budget: cells[6].textContent.trim(),
                    number_of_positions: cells[7].textContent.trim(),
                    work_mode: cells[8].textContent.trim()
                };
                break;
            }
        }

        if (!jdData) throw new Error('Job description data not found');

        const content = `
            <div class="mb-3">
                <label class="form-label">Job Title</label>
                <input type="text" class="form-control" id="editJdTitle" value="${jdData.title}">
            </div>
            <div class="mb-3">
                <label class="form-label">Required Experience</label>
                <input type="text" class="form-control" id="editReqExp" value="${jdData.required_experience}" placeholder="e.g., 3-5 years">
            </div>
            <div class="mb-3">
                <label class="form-label">Primary Skills (comma separated)</label>
                <textarea class="form-control" id="editPrimarySkills" rows="2">${jdData.primary_skills.join(', ')}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Secondary Skills (comma separated)</label>
                <textarea class="form-control" id="editSecondarySkills" rows="2">${jdData.secondary_skills.join(', ')}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Location</label>
                <input type="text" class="form-control" id="editLocation" value="${jdData.location}">
            </div>
            <div class="mb-3">
                <label class="form-label">Budget</label>
                <input type="text" class="form-control" id="editBudget" value="${jdData.budget}">
            </div>
            <div class="mb-3">
                <label class="form-label">Number of Positions</label>
                <input type="number" class="form-control" id="editPositions" value="${jdData.number_of_positions}">
            </div>
            <div class="mb-3">
                <label class="form-label">Work Mode</label>
                <select class="form-select" id="editWorkMode">
                    <option value="in-office" ${jdData.work_mode === 'in-office' ? 'selected' : ''}>In-Office</option>
                    <option value="remote" ${jdData.work_mode === 'remote' ? 'selected' : ''}>Remote</option>
                    <option value="hybrid" ${jdData.work_mode === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                </select>
            </div>
        `;

        const modalId = 'editJdModal';
        if (!document.getElementById(modalId)) {
            const modalHTML = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Edit Job Description</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body" id="${modalId}Body">${content}</div>
                            <div class="modal-footer">
                            
                                <button type="button" class="btn btn-primary" onclick="saveJDChanges1('${jdId}')">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        } else {
            document.getElementById(`${modalId}Body`).innerHTML = content;
        }

        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

    } catch (error) {
        console.error('Error loading JD details:', error);
        showMessage(error.message, 'error');
    }
}
// Save JD changes
async function saveJDChanges1(jdId) {
    const payload = {
        title: document.getElementById('editJdTitle').value.trim(),
        required_experience: document.getElementById('editReqExp').value.trim(),
        primary_skills: document.getElementById('editPrimarySkills').value.split(',').map(s => s.trim()).filter(Boolean),
        secondary_skills: document.getElementById('editSecondarySkills').value.split(',').map(s => s.trim()).filter(Boolean),
        location: document.getElementById('editLocation').value.trim(),
        budget: document.getElementById('editBudget').value.trim(),
        number_of_positions: Number(document.getElementById('editPositions').value),
        work_mode: document.getElementById('editWorkMode').value
    };

    if (!payload.title || !payload.required_experience || payload.primary_skills.length === 0) {
        showMessage('Title, required experience, and at least one primary skill are required', 'error');
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE_URL}/job-descriptions/${jdId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showMessage('Job description updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editJdModal')).hide();
            loadClientsTable(); // Refresh table
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update job description');
        }
    } catch (error) {
        console.error('Error updating job description:', error);
        showMessage(error.message, 'error');
    }
}


// Delete job description
// async function deleteJobDescription(jdId, jdTitle) {
//     if (!confirm(`Are you sure you want to delete the job description "${jdTitle}"?`)) {
//         return;
//     }
    
//     try {
//         const response = await apiFetch(`${API_BASE_URL}/job-descriptions/${jdId}`, {
//             method: 'DELETE'
//         });
        
//         if (response.ok) {
//             showMessage('Job description deleted successfully', 'success');
//             // Refresh the JD modal if it's open
//             const jdModal = document.getElementById('jdModal');
//             if (jdModal && jdModal.classList.contains('show')) {
//                 bootstrap.Modal.getInstance(jdModal).hide();
//             }
//             // Reload the clients table
//             loadClientsTable();
//         } else {
//             const errorData = await response.json();
//             throw new Error(errorData.detail || 'Failed to delete job description');
//         }
//     } catch (error) {
//         console.error('Error deleting job description:', error);
//         showMessage(error.message, 'error');
//     }
// }
        function showCompanyInfo() {
    document.getElementById('dashboardStats').style.display = 'none';
    setActiveLink('info');
    document.getElementById('dataSectionTitle').textContent = 'Company Information';
    document.getElementById('dataFilterDropdownContainer').style.display = 'block';

    const content = document.getElementById("dataContent");

    if (companyData) {
        content.innerHTML = `
            <div class="container">
                <!-- Logo & Header -->
                <div class="text-center mb-4">
                    <label for="logoUpload" style="cursor: pointer;">
                        ${companyData.logo_url 
                            ? `<img src="${API_BASE_URL}${companyData.logo_url}" 
                                    alt="Company Logo" 
                                    class="rounded-circle shadow-sm" 
                                    style="width:120px; height:120px; object-fit:cover;">`
                            : `<div class="rounded-circle bg-light d-flex align-items-center justify-content-center shadow-sm"
                                    style="width:120px; height:120px;">
                                    <span class="text-muted">No Logo</span>
                               </div>`}
                    </label>
                    <input type="file" id="logoUpload" accept="image/jpeg,image/png,image/gif" style="display: none;">
                    <div class="form-text mt-2">Add Logo</div>
                    <h4 class="mt-3 mb-0">${companyData.name}</h4>
                </div>

                <!-- General Info -->
                <div class="row g-3">
                    <!-- Row 1 -->
                    <div class="col-md-4">
                        <label class="form-label">Company Name</label>
                        <input type="text" class="form-control company-field edit" data-field="name" 
                            value="${companyData.name}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Company Legal Name</label>
                        <input type="text" class="form-control company-field edit" data-field="legal_name" 
                               value="${companyData.legal_name || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Website</label>
                        <input type="url" class="form-control company-field edit" data-field="website" 
                               value="${companyData.website || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control company-field edit" data-field="email" 
                               value="${companyData.email || ''}" readonly>
                    </div>
                    
                    <!-- Row 2 -->
                    <div class="col-md-4">
                        <label class="form-label">Mobile</label>
                        <input type="text" class="form-control company-field edit" data-field="mobile" 
                               value="${companyData.mobile || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">GST</label>
                        <input type="text" class="form-control company-field edit" data-field="gst" 
                               value="${companyData.gst || ''}" readonly>
                    </div>
                    
                    <!-- Row 3 -->
                    <div class="col-md-4">
                        <label class="form-label">Country</label>
                        <input type="text" class="form-control no-edit" value="${companyData.country || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">State</label>
                        <div class="dropdown-select">
                            <input type="text" class="form-control company-field edit dropdown-display searchable-dropdown" 
                                   data-field="state" data-dropdown-type="state"
                                   value="${companyData.state || ''}" 
                                   placeholder="Type to search states..." readonly>
                            <div class="dropdown-options" style="display: none;">
                                <select class="form-select company-field edit dropdown-list" data-field="state" size="6">
                                    <option value="">Select State</option>
                                    <!-- States will be loaded dynamically -->
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">City</label>
                        <input type="text" class="form-control company-field edit" data-field="city" 
                               value="${companyData.city || ''}" readonly>
                    </div>

                    <!-- Row 4 -->
                    
                    <div class="col-md-4">
                        <label class="form-label">Pincode</label>
                        <input type="text" class="form-control company-field edit" data-field="pincode" 
                               value="${companyData.pincode || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Quotation Prefix</label>
                        <input type="text" class="form-control no-edit" data-field="quotation_prefix" 
                               value="${companyData.quotation_prefix || ''}" readonly>
                    </div>
                    <div class="col-md-8">
                        <label class="form-label">Registered Address</label>
                        <input type="text" class="form-control company-field edit" data-field="registered_address" 
                               value="${companyData.registered_address || ''}" readonly>
                    </div>
                </div>

                <!-- Bank Details -->
                <h5 class="mt-4 mb-3">Bank Details</h5>
                <div class="row g-3">
                    
                    <div class="col-md-4">
                        <label class="form-label">Bank Name</label>
                        <div class="dropdown-select">
                            <input type="text" class="form-control company-field edit dropdown-display searchable-dropdown" 
                                   data-field="bank_name" data-dropdown-type="bank"
                                   value="${companyData.bank_name || ''}" 
                                   placeholder="Type to search banks..." readonly>
                            <div class="dropdown-options" style="display: none;">
                                <select class="form-select company-field edit dropdown-list" data-field="bank_name" size="6">
                                    <option value="">Select Bank</option>
                                    <!-- Banks will be loaded dynamically -->
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <label class="form-label">IFSC Code</label>
                        <div class="input-group">
                            <span class="input-group-text" id="ifscPrefixDisplay">${companyData.ifsc_code ? companyData.ifsc_code.substring(0, 4) : '____'}</span>
                            <input type="text" class="form-control company-field edit" data-field="ifsc_suffix" 
                                   value="${companyData.ifsc_code ? companyData.ifsc_code.substring(4) : ''}" 
                                   maxlength="7" pattern="[A-Z0-9]{7}" readonly>
                            <input type="hidden" class="company-field edit" data-field="ifsc_code" value="${companyData.ifsc_code || ''}">
                        </div>
                        
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Bank Branch</label>
                        <input type="text" class="form-control company-field edit" data-field="bank_branch" 
                               value="${companyData.bank_branch || ''}" readonly>
                    </div>
                    
                    <div class="col-md-4">
                        <label class="form-label">Account Holder Name</label>
                        <input type="text" class="form-control company-field edit" data-field="account_holder_name" 
                               value="${companyData.account_holder_name || ''}" readonly>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Account Number</label>
                        <input type="text" class="form-control company-field edit" data-field="account_number" 
                               value="${companyData.account_number || ''}" readonly>
                    </div>
                    <div class="col-md-8">
                        <label class="form-label">Bank Address</label>
                        <input type="text" class="form-control company-field edit" data-field="bank_address" 
                               value="${companyData.bank_address || ''}" readonly>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="row mt-4">
                    <div class="col-12 text-center">
                        <button class="btn btn-primary" id="updateButton" onclick="updateCompanyInfo()">
                            <i class="fas fa-upload me-1"></i> Update
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Load dropdown data after rendering
        loadStatesForCompany(companyData.country, companyData.state);
        loadActiveBanksForCompany();
        
        // Set up logo upload
        document.getElementById('logoUpload').addEventListener('change', function(e) {
            uploadCompanyLogo(companyData.id);
        });

        // Make fields editable on click
        const fields = document.querySelectorAll('.company-field');
        fields.forEach(field => {
            if (field.type === 'text' || field.type === 'email' || field.type === 'url') {
                field.addEventListener('click', function() {
                    this.readOnly = false;
                    this.classList.add('editing');
                    this.focus();
                });
                
                field.addEventListener('blur', function() {
                    this.readOnly = true;
                    this.classList.remove('editing');
                });
                field.addEventListener('input', function () {
                    const fieldName = this.dataset.field;
                    let value = this.value;

                    // Apply capitalization & validation
                    if (fieldName === 'name' || fieldName === 'legal_name' || fieldName === 'city' || fieldName === 'bank_branch' || fieldName === 'account_holder_name') {
                        // Allow only letters and spaces
                        value = value.replace(/[^A-Za-z\s]/g, '');
                        // Convert fully caps to proper case
                        if (value === value.toUpperCase()) {
                            value = capitalizeWords(value.toLowerCase());
                        }
                        // Limit length
                        if (fieldName === 'name' || fieldName === 'legal_name') value = value.slice(0, 25);
                        if (fieldName === 'city') value = value.slice(0, 25);
                    }
                    else if (fieldName === 'registered_address' || fieldName === 'bank_address') {
                        // Allow alphanumeric + space + comma + dot
                        value = value.replace(/[^A-Za-z0-9\s,.-]/g, '').slice(0, 150);
                    }
                    else if (fieldName === 'mobile') {
                        value = value.replace(/\D/g, '').slice(0, 10);
                    }
                    else if (fieldName === 'gst') {
                        value = value.replace(/\D/g, '').slice(0, 2);
                    }
                    else if (fieldName === 'pincode') {
                        value = value.replace(/\D/g, '').slice(0, 6);
                    }
                    else if (fieldName === 'account_number') {
                        value = value.replace(/\D/g, '').slice(0, 18);
                    }

                    this.value = value;
                });
            }
        });

        // Setup dropdown functionality
        setupDropdowns();

    } else {
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i> Company information not available
            </div>
        `;
    }
}

// Setup dropdown functionality
function setupDropdowns() {
    const searchableDropdowns = document.querySelectorAll('.searchable-dropdown');
    
    searchableDropdowns.forEach(dropdown => {
        // Click to show dropdown
        dropdown.addEventListener('click', function() {
            const dropdownContainer = this.parentElement;
            const optionsContainer = dropdownContainer.querySelector('.dropdown-options');
            
            // Hide all other dropdowns
            document.querySelectorAll('.dropdown-options').forEach(opt => {
                if (opt !== optionsContainer) {
                    opt.style.display = 'none';
                }
            });
            
            // Toggle current dropdown
            if (optionsContainer.style.display === 'block') {
                optionsContainer.style.display = 'none';
            } else {
                optionsContainer.style.display = 'block';
                this.readOnly = false;
                this.focus();
            }
        });

        // Enable typing to search
        dropdown.addEventListener('input', function() {
            const dropdownContainer = this.parentElement;
            const dropdownList = dropdownContainer.querySelector('.dropdown-list');
            const searchTerm = this.value.toLowerCase();
            
            if (dropdownList) {
                const options = dropdownList.options;
                
                for (let i = 0; i < options.length; i++) {
                    const optionText = options[i].textContent.toLowerCase();
                    if (optionText.includes(searchTerm)) {
                        options[i].style.display = '';
                    } else {
                        options[i].style.display = 'none';
                    }
                }
            }
        });

        // Close dropdown when focus is lost
        dropdown.addEventListener('blur', function() {
            setTimeout(() => {
                const dropdownContainer = this.parentElement;
                const optionsContainer = dropdownContainer.querySelector('.dropdown-options');
                if (optionsContainer) {
                    optionsContainer.style.display = 'none';
                }
                this.readOnly = true;
            }, 200);
        });
    });

    // Handle dropdown selection
    document.querySelectorAll('.dropdown-list').forEach(select => {
        select.addEventListener('change', function() {
            const dropdownContainer = this.closest('.dropdown-select');
            const display = dropdownContainer.querySelector('.dropdown-display');
            display.value = this.value;
            this.closest('.dropdown-options').style.display = 'none';
            display.readOnly = true;
            
            // Update IFSC prefix if bank is selected
            if (this.dataset.field === 'bank_name') {
                const selectedOption = this.options[this.selectedIndex];
                const ifscPrefix = selectedOption?.dataset.ifscPrefix || '';
                document.getElementById('ifscPrefixDisplay').textContent = ifscPrefix || '____';
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-select')) {
            document.querySelectorAll('.dropdown-options').forEach(options => {
                options.style.display = 'none';
            });
            document.querySelectorAll('.searchable-dropdown').forEach(dropdown => {
                dropdown.readOnly = true;
            });
        }
    });
}

// Update company information
async function updateCompanyInfo() {
    const updateData = {};
    const fields = document.querySelectorAll('.company-field');
    
    fields.forEach(field => {
        const fieldName = field.dataset.field;
        let value = field.value.trim();
        
        if (value) {
            // Handle IFSC code separately
            if (fieldName === 'ifsc_suffix') {
                const prefix = document.getElementById('ifscPrefixDisplay').textContent;
                if (prefix !== '____' && value) {
                    updateData['ifsc_code'] = prefix + value.toUpperCase();
                }
            } else if (fieldName !== 'ifsc_code') {
                updateData[fieldName] = value;
            }
        }
    });

    if (Object.keys(updateData).length === 0) {
        showMessage("No changes to update", "info");
        return;
    }
    // Validation rules
    for (const field of fields) {
        const name = field.dataset.field;
        const value = field.value.trim();

        if (!value) continue; // skip empty optional

        switch (name) {
            case 'name':
            case 'legal_name':
                if (!isAlpha(value) || value.length > 25) {
                    showMessage("Company Name / Legal Name: only alphabets, max 25 chars", "error");
                    return;
                }
                break;

            case 'website':
                if (value && !isValidWebsite(value)) {
                    showMessage("Invalid website URL", "error");
                    return;
                }
                break;

            case 'email':
                if (value && !isValidEmail(value)) {
                    showMessage("Invalid email address", "error");
                    return;
                }
                break;

            case 'mobile':
                if (!isValidMobile(value)) {
                    showMessage("Mobile number must be 10 digits", "error");
                    return;
                }
                break;

            case 'gst':
                if (!isValidGST(value)) {
                    showMessage("GST must be exactly 2 digits", "error");
                    return;
                }
                break;

            case 'city':
                if (!isAlpha(value) || value.length > 25) {
                    showMessage("City: only alphabets allowed (max 25 chars)", "error");
                    return;
                }
                break;

            case 'pincode':
                if (!isValidPincode(value)) {
                    showMessage("Invalid pincode", "error");
                    return;
                }
                break;

            case 'registered_address':
            case 'bank_address':
                if (!isAlphanumeric(value.replace(/[.,\s]/g, '')) || value.length > 150) {
                    showMessage("Address: max 150 chars (letters, numbers, comma, dot allowed)", "error");
                    return;
                }
                break;

            case 'bank_branch':
            case 'account_holder_name':
                if (!isAlpha(value)) {
                    showMessage("Bank Branch / Account Holder Name: letters only", "error");
                    return;
                }
                break;

            case 'account_number':
                if (!isValidAccountNumber(value)) {
                    showMessage("Account Number must be 9–18 digits", "error");
                    return;
                }
                break;
        }
    }


    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyData.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-Role": "company_admin"
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to update company information");
        }

        showMessage("Company information updated successfully", "success");
        // Refresh company data
        await loadCompanyData();
        showCompanyInfo();
    } catch (error) {
        showMessage(error.message || "Error updating company information", "error");
    }
}

// Upload company logo
async function uploadCompanyLogo(companyId) {
    const logoFile = document.getElementById("logoUpload").files[0];
    
    if (!logoFile) return;
    
    if (logoFile.size > 1024 * 1024) {
        showMessage("File size must be less than 1MB", "error");
        return;
    }
    
    if (!logoFile.type.match("image/jpeg|image/png|image/gif")) {
        showMessage("Only JPEG, PNG and GIF images are allowed", "error");
        return;
    }
    
    const formData = new FormData();
    formData.append("logo", logoFile);
    
    try {
        const response = await apiFetch(`${API_BASE_URL}/companies/${companyId}/logo`, {
            method: "POST",
            headers: {
                "X-User-Role": "company_admin"
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to upload logo");
        }
        
        showMessage("Logo updated successfully", "success");
        // Refresh company data
        await loadCompanyData();
        showCompanyInfo();
    } catch (error) {
        console.error("Error uploading logo:", error);
        showMessage(error.message || "Error uploading logo", "error");
    }
}

// Load active banks for dropdown
async function loadActiveBanksForCompany() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/banks?status=active`, {
        });
        
        if (response.ok) {
            const banks = await response.json();
            const bankList = document.querySelector('select[data-field="bank_name"]');
            
            if (bankList) {
                // Store current bank value
                const currentBank = companyData.bank_name;
                
                banks.forEach(bank => {
                    const option = document.createElement("option");
                    option.value = bank.bank_name;
                    option.textContent = `${bank.bank_name}`;
                    option.dataset.ifscPrefix = bank.ifsc_prefix;
                    bankList.appendChild(option);
                    
                    // Select current bank if it matches
                    if (bank.bank_name === currentBank) {
                        option.selected = true;
                        // Update IFSC prefix display
                        document.getElementById('ifscPrefixDisplay').textContent = bank.ifsc_prefix;
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error loading banks:", error);
    }
}

// Load states for selected country
async function loadStatesForCompany(countryName, selectedState = null) {
    try {
        // First try to get country ID by name
        const countriesResponse = await apiFetch(`${API_BASE_URL}/countries`, {
        });
        
        if (countriesResponse.ok) {
            const countries = await countriesResponse.json();
            let countryId = null;
            
            // Find the country ID by name
            for (const country of countries) {
                if (country.name === countryName) {
                    countryId = country.id;
                    break;
                }
            }
            
            if (countryId) {
                const statesResponse = await apiFetch(`${API_BASE_URL}/countries/${countryId}/states`, {
                });
                
                if (statesResponse.ok) {
                    const states = await statesResponse.json();
                    const stateList = document.querySelector('select[data-field="state"]');
                    
                    if (stateList) {
                        states.forEach(state => {
                            const option = document.createElement("option");
                            option.value = state.name;
                            option.textContent = state.name;
                            stateList.appendChild(option);

                            // Select current state if it matches
                            if (state.name === selectedState) {
                                option.selected = true;
                            }
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error loading states:", error);
    }
}

// Add CSS for editing mode and dropdowns
const style = document.createElement('style');
style.textContent = `
.edit{
    background-color: white !important;
}
.no-edit {
    background-color: #f8f9fa !important;
    cursor: not-allowed;
}
    .company-field.editing {
        border-color: #667eea;
        background-color: #f8f9fa;
    }
    .company-field:read-only {
        background-color: #f8f9fa;
        cursor: pointer;
    }
    .company-field:read-only:hover {
        border-color: #ced4da;
        background-color: #e9ecef;
    }
    .dropdown-select {
        position: relative;
    }
    .dropdown-options {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        z-index: 1000;
        background: white;
        border: 1px solid #ced4da;
        border-top: none;
        border-radius: 0 0 0.375rem 0.375rem;
        box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }
    .dropdown-list {
        border: none;
        border-radius: 0;
        width: 100%;
    }
    .dropdown-list option {
        padding: 0.5rem;
    }
    .dropdown-list option:hover {
        background-color: #f8f9fa;
    }
    .input-group-text {
        min-width: 60px;
        font-family: monospace;
        font-weight: bold;
    }
    .searchable-dropdown {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' class='bi bi-chevron-down' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 16px 12px;
    }
`;
document.head.appendChild(style);
        // Create a helper function for authenticated requests
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

        
        // Add this function to check if a client exists
        async function checkClientExists(clientName) {
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients`);
                const clients = await res.json();
                
                // Convert both to lowercase for case-insensitive comparison
                const clientNameLower = clientName.toLowerCase().trim();
                return clients.some(client => client.toLowerCase().trim() === clientNameLower);
            } catch (error) {
                console.error('Error checking client existence:', error);
                return false;
            }
        }

        // Add this function to check if a JD exists for a specific client
        async function checkJDExists(clientName, jdTitle) {
            try {
                const res = await apiFetch(`${API_BASE_URL}/clients/${encodeURIComponent(clientName)}/jds`);
                const jds = await res.json();
                
                // Convert both to lowercase for case-insensitive comparison
                const jdTitleLower = jdTitle.toLowerCase().trim();
                return jds.some(jd => jd.toLowerCase().trim() === jdTitleLower);
            } catch (error) {
                console.error('Error checking JD existence:', error);
                return false;
            }
        }

        // Modify the analyzeResume function to include validation
        async function analyzeResume() {
  const resumeInput = document.getElementById('resume');
  const fileError = document.getElementById('file-error');
  const analyzeBtn = document.getElementById('analyze_btn');
  const analyzeLoading = document.getElementById('analyzeLoading');

  let missingFields = [];

  // ✅ Check resume upload
  if (!resumeInput.files.length) {
    missingFields.push("Upload Resume");
  }

  const usingExisting = document.querySelector('input[name="client_mode"][value="existing"]').checked;
  let jd;

  if (usingExisting) {
    // Existing client mode
    const clientSelect = document.getElementById('existing_client_select');
    const jdSelect = document.getElementById('jd_select');
    const jdReqExp = document.getElementById('jd_req_exp');
    const jdPrimary = document.getElementById('jd_primary');
    const jdSecondary = document.getElementById('jd_secondary');
    const location = document.getElementById('location');
    const budget = document.getElementById('budget');

    // Collect missing fields
    if (!clientSelect.value || clientSelect.value === "Choose One") {
      missingFields.push("Choose Client");
    }
    if (!jdSelect.value || jdSelect.value === "Choose One") {
      missingFields.push("Choose Job Description");
    }

    // If required dropdowns not filled → stop here
    if (missingFields.length) {
      alert("Please fill in the following required fields:\n- " + missingFields.join("\n- "));
      return;
    }

    // Build JD object
    jd = {
      client_name: clientSelect.value,
      jd_title: jdSelect.value,
      required_experience: jdReqExp?.value.trim() || '',
      primary_skills: (jdPrimary?.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      secondary_skills: (jdSecondary?.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    };

  } else {
    // New client mode
    const clientName = document.getElementById('client_name')?.value.trim();
    const jdTitle = document.getElementById('jd_title')?.value.trim();
    const requiredExp = document.getElementById('required_experience')?.value.trim();
    const primarySkills = document.getElementById('primary_skills')?.value.trim();
    const secondarySkills = document.getElementById('secondary_skills')?.value.trim();

    // New fields
    const location = document.getElementById('location')?.value.trim();
    const budget = document.getElementById('budget')?.value.trim();
    const numberOfPositions = document.getElementById('number_of_positions')?.value;
    const workMode = document.getElementById('work_mode')?.value;

    // Validate required fields
    if (!clientName) missingFields.push("Client Name");
    if (!jdTitle) missingFields.push("Job Description Name");
    if (!requiredExp) missingFields.push("Required Experience");
    if (!primarySkills) missingFields.push("Primary Skills");
    if (!location) missingFields.push("Location");       // ✅ NEW
    if (!budget) missingFields.push("Budget");           // ✅ NEW

    // If some required fields are missing → stop here
    if (missingFields.length) {
      alert("Please fill in the following required fields:\n- " + missingFields.join("\n- "));
      return;
    }

    // Validate required experience format
    if (!/^\d+\s*\+|\d+\s*-\s*\d+$/.test(requiredExp)) {
      alert("Invalid experience format! Use '3-5', '4+' or '5 +'");
      return;
    }

    // Check for duplicate JD
    const jdExists = await checkJDExists(clientName, jdTitle);
    if (jdExists) {
      alert(`Job Description "${jdTitle}" already exists for client "${clientName}". Please use a different name.`);
      return;
    }

    // Build JD object
    jd = {
      client_name: clientName,
      jd_title: jdTitle,
      required_experience: requiredExp,
      primary_skills: primarySkills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      secondary_skills: secondarySkills
        ? secondarySkills.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      location: location || null,
      budget: budget || null,
      number_of_positions: numberOfPositions ? parseInt(numberOfPositions) : null,
      work_mode: workMode || null,
    };
  }

  // If resume missing after JD is valid → show specific error
  if (!resumeInput.files.length) {
    fileError.textContent = 'Please upload a resume file.';
    fileError.style.display = 'block';
    return;
  }
  fileError.style.display = 'none';

  // === Continue with API call ===
  const fd = new FormData();
  fd.append('resume', resumeInput.files[0]);
  fd.append('jd_data', JSON.stringify(jd));

  const analysisContainer = document.getElementById('analysis_container');
  analysisContainer.classList.add('hidden');
  analyzeBtn.disabled = true;
  analyzeLoading.style.display = 'block';

  try {
    const resp = await apiFetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: fd,
    });

    if (!resp.ok) throw new Error(`Server returned ${resp.status}: ${resp.statusText}`);

    const json = await resp.json();
    renderAnalysis(json);
    loadAnalysisHistory();

  } catch (err) {
    console.error('Analysis error:', err);
    analysisContainer.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Error analyzing resume: ${err.message || 'Unknown error'}
      </div>
    `;
    analysisContainer.classList.remove('hidden');

  } finally {
    analyzeBtn.disabled = false;
    analyzeLoading.style.display = 'none';
  }
}



        // Add real-time validation for client name input (informational only)
        function initClientNameValidation() {
            const clientNameInput = document.getElementById('client_name');
            if (!clientNameInput) return;
            
            let validationTimeout;
            
            clientNameInput.addEventListener('input', function() {
                clearTimeout(validationTimeout);
                const clientName = this.value.trim();
                
                if (!clientName) {
                    // Remove any existing messages
                    const warning = this.nextElementSibling;
                    if (warning && warning.classList.contains('client-warning')) {
                        warning.remove();
                    }
                    return;
                }
                
                validationTimeout = setTimeout(async () => {
                    const exists = await checkClientExists(clientName);
                    
                    // Show informational message (not an error)
                    let message = this.nextElementSibling;
                    if (!message || !message.classList.contains('client-warning')) {
                        message = document.createElement('div');
                        message.className = 'client-warning small mt-1';
                        this.parentNode.appendChild(message);
                    }
                    
                    if (exists) {
                        message.textContent = `Client "${clientName}" already exists. You can create a new job description for this client.`;
                        message.className = 'client-warning text-info small mt-1';
                        this.style.borderColor = '';
                    } else {
                        message.textContent = `This will create a new client "${clientName}".`;
                        message.className = 'client-warning text-success small mt-1';
                        this.style.borderColor = '';
                    }
                }, 800); // Delay to avoid too many API calls
            });
        }

        // Add real-time validation for JD title input
        function initJDTitleValidation() {
            const jdTitleInput = document.getElementById('jd_title');
            const clientNameInput = document.getElementById('client_name');
            
            if (!jdTitleInput || !clientNameInput) return;
            
            let validationTimeout;
            
            jdTitleInput.addEventListener('input', function() {
                clearTimeout(validationTimeout);
                const jdTitle = this.value.trim();
                const clientName = clientNameInput.value.trim();
                
                if (!jdTitle) {
                    // Remove any existing messages
                    const warning = this.nextElementSibling;
                    if (warning && warning.classList.contains('jd-warning')) {
                        warning.remove();
                    }
                    this.style.borderColor = '';
                    return;
                }
                
                if (!clientName) {
                    // Remove any existing messages
                    const warning = this.nextElementSibling;
                    if (warning && warning.classList.contains('jd-warning')) {
                        warning.remove();
                    }
                    this.style.borderColor = '';
                    return;
                }
                
                validationTimeout = setTimeout(async () => {
                    const exists = await checkJDExists(clientName, jdTitle);
                    if (exists) {
                        this.setCustomValidity(`Job Description "${jdTitle}" already exists for client "${clientName}".`);
                        this.style.borderColor = '#dc3545';
                        
                        // Show warning message
                        let warning = this.nextElementSibling;
                        if (!warning || !warning.classList.contains('jd-warning')) {
                            warning = document.createElement('div');
                            warning.className = 'jd-warning text-danger small mt-1';
                            this.parentNode.appendChild(warning);
                        }
                        warning.textContent = `Job Description "${jdTitle}" already exists for this client.`;
                    } else {
                        this.setCustomValidity('');
                        this.style.borderColor = '';
                        
                        // Remove warning message
                        const warning = this.nextElementSibling;
                        if (warning && warning.classList.contains('jd-warning')) {
                            warning.remove();
                        }
                    }
                }, 800); // Delay to avoid too many API calls
            });
            
            // Also validate when client name changes
            clientNameInput.addEventListener('input', function() {
                if (jdTitleInput.value.trim()) {
                    jdTitleInput.dispatchEvent(new Event('input'));
                }
            });
        }

   
        // Add real-time validation for Required Experience input
        function initRequiredExpValidation() {
            const reqExpInput = document.getElementById('required_experience');
            if (!reqExpInput) return;

            let validationTimeout;

            reqExpInput.addEventListener('input', function() {
                clearTimeout(validationTimeout);
                const value = this.value.trim();

                // Remove old warning if exists
                let warning = this.nextElementSibling;
                if (warning && warning.classList.contains('exp-warning')) {
                    warning.remove();
                }

                validationTimeout = setTimeout(() => {
                    if (!value) {
                        this.setCustomValidity('Required experience is mandatory.');
                        this.style.borderColor = '#dc3545';

                        warning = document.createElement('div');
                        warning.className = 'exp-warning text-danger small mt-1';
                        warning.textContent = 'Required experience is mandatory.';
                        this.parentNode.appendChild(warning);
                        return;
                    }

                    // Allow formats like "3-5", "4+", "5 +"
                    const expPattern = /^(\d+\s*-\s*\d+|\d+\s*\+)$/;
                    if (!expPattern.test(value)) {
                        this.setCustomValidity("Invalid format! Use '3-5', '4+' or '5 +'.");
                        this.style.borderColor = '#dc3545';

                        warning = document.createElement('div');
                        warning.className = 'exp-warning text-danger small mt-1';
                        warning.textContent = "Invalid format! Use '3-5', '4+' or '5 +'.";
                        this.parentNode.appendChild(warning);
                    } else {
                        this.setCustomValidity('');
                        this.style.borderColor = '';

                        warning = document.createElement('div');
                        warning.className = 'exp-warning text-success small mt-1';
                        warning.textContent = `Valid format detected: "${value}"`;
                        this.parentNode.appendChild(warning);
                    }
                }, 500); // Delay for smoother typing experience
            });
        }
        // Add real-time validation for Primary Skills input
        function initPrimarySkillsValidation() {
            const skillsInput = document.getElementById('primary_skills');
            if (!skillsInput) return;

            let validationTimeout;

            skillsInput.addEventListener('input', function() {
                clearTimeout(validationTimeout);
                const value = this.value.trim();

                // Remove old warning if exists
                let warning = this.nextElementSibling;
                if (warning && warning.classList.contains('skills-warning')) {
                    warning.remove();
                }

                validationTimeout = setTimeout(() => {
                    if (!value) {
                        this.setCustomValidity('Primary skills are mandatory.');
                        this.style.borderColor = '#dc3545';

                        warning = document.createElement('div');
                        warning.className = 'skills-warning text-danger small mt-1';
                        warning.textContent = 'Primary skills are mandatory.';
                        this.parentNode.appendChild(warning);
                        return;
                    }

                    // ✅ Valid (not empty)
                    this.setCustomValidity('');
                    this.style.borderColor = '';

                    warning = document.createElement('div');
                    warning.className = 'skills-warning text-success small mt-1';
                    warning.textContent = `Skills entered: ${value}`;
                    this.parentNode.appendChild(warning);
                }, 500);
            });
        }
        // Render analysis results
        function renderAnalysis(payload) {
            const analysisContainer = document.getElementById('analysis_container');
            if (!analysisContainer) return;
            
            if (!payload || !payload.analysis) { 
                analysisContainer.innerHTML = '<div class="alert alert-danger">No analysis returned from server</div>'; 
                analysisContainer.classList.remove('hidden');
                return; 
            }
            
            const data = payload.analysis;
            const score = (data.skill_analysis && data.skill_analysis.match_score) || 0;
            const candidateName = (data.candidate_info && data.candidate_info.candidate_name) || 'Not specified';
            const primaryMatched = (data.skill_analysis && data.skill_analysis.matching_skills) || [];
            const primaryMissing = (data.skill_analysis && data.skill_analysis.missing_primary_skills) || [];
            const secondaryMissing = (data.skill_analysis && data.skill_analysis.missing_secondary_skills) || [];
            const positions = (data.experience_analysis && data.experience_analysis.positions) || [];
            const totalExp = (data.experience_analysis && data.experience_analysis.total_experience) || 'N/A';
            const expMatch = (data.experience_analysis && data.experience_analysis.experience_match) || false;
            const frequentHopper = (data.experience_analysis && data.experience_analysis.frequent_hopper) || false;
            const jdExp = (data.experience_analysis && data.experience_analysis.required_experience) || "N/A";
            const summary = data.summary || '';

            const rows = positions.map((p, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td><b>${p.company || 'Unknown'}</b><br/>${p.title || 'Unknown'}</td>
                    <td>
                        ${p.duration_missing 
                            ? '<span style="color:red;">📅 Start and End Date Missing</span>' 
                            : (() => {
                                if (p.duration && p.duration.includes("-")) {
                                    const [start, end] = p.duration.split("-");
                                    return `${start.trim()} - ${end.trim()}`;
                                }
                                return p.duration || 'N/A';
                            })()
                        }
                    </td>
                    <td>${p.duration_missing ? '' : (p.duration_length || 'N/A')}</td>
                    <td>${p.is_internship ? '🎓 Internship' : '💼 Full-time'}</td>
                </tr>
            `).join('');

            // Add total experience row at the end
            const totalRow = `
                <tr class="total-exp-row">
                    <td></td>
                    <td style="text-align:center; font-weight:bold; background:#fffde7;">Total Experience</td>
                    <td></td>
                    <td style="background:#fffde7;"><b>${totalExp}</b></td>
                    <td></td>
                </tr>
            `;

            analysisContainer.innerHTML = `
                <div class="analysis-card">
                    <h2 style="text-align: center;">Resume Analysis Report</h2>
                    <p class="candidate-name">👤 Candidate Name: <b>${candidateName}</b></p>

                    <div class="match-score">
                        <div class="progress-circle" style="background: conic-gradient(#4CAF50 ${score}%, #f0f0f0 ${score}% 100%);">
                            <div class="progress-circle-inner"><span>${score}%</span></div>
                        </div>
                        <div><strong>Overall Match Score</strong></div>
                    </div>

                    ${summary ? `
                    <div class="profile-feedback">
                        <strong>📝 Profile Feedback</strong>
                        <div class="panel">${summary}</div>
                    </div>` : ''}

                    <h3>📊 Experience Analysis</h3>
                    <div class="metrics">
                        <div class="metric-card">
                            <div class="metric-title">Required Experience per JD</div>
                            <div class="metric-value">${jdExp} Years</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-title">Candidate's Experience</div>
                            <div class="metric-value">${totalExp}</div>
                        </div>
                        <div class="metric-card ${expMatch ? 'match' : 'no-match'}">
                            <div class="metric-title">Experience Match</div>
                            <div class="metric-value">${expMatch ? '✅ Match' : '❌ No Match'}</div>
                        </div>
                        <div class="metric-card ${frequentHopper ? 'frequent-hopper' : 'stable'}">
                            <div class="metric-title">Frequent Hopper(hopping within 1 month - 11 months)</div>
                            <div class="metric-value">${frequentHopper ? '⚠️ Yes' : '✅ No'}</div>
                        </div>
                    </div>

                    <h3>📑 Detailed Work History</h3>
                    <div class="table">
                        <table>
                            <thead style="background:#fffde7;">
                                <tr><th>S.No</th><th>Company & Role</th><th>Start & End Date</th><th>Duration</th><th>Job Type</th></tr>
                            </thead>
                            <tbody>${rows}${totalRow}</tbody>
                        </table>
                    </div>

                    <h3>💡 Skills Analysis Summary</h3>
                    <div class="skill-row">
                        <div class="skill-box">
                            <h5>Primary Skills (Must Have)</h5>
                            ${primaryMatched.map(s => `<div class="skill-item skill-matched">✔️ ${s}</div>`).join('')}
                            ${primaryMissing.map(s => `<div class="skill-item skill-missing-primary">✖️ ${s}</div>`).join('')}
                        </div>
                        <div class="skill-box">
                            <h5>Secondary Skills (Nice to Have)</h5>
                            ${secondaryMissing.length
                                ? secondaryMissing.map(s => `<div class="skill-item skill-missing-secondary">⚠️ ${s}</div>`).join('')
                                : '<div class="skill-item skill-matched">✅ All secondary skills are matched!</div>'}
                        </div>
                    </div>
                </div>
            `;
            
            analysisContainer.classList.remove('hidden');
        }

        // Load analysis history
        async function loadAnalysisHistory() {
    try {
        // Fetch resume analyses history
        const res = await apiFetch(`${API_BASE_URL}/history`);
        if (res.ok) {
            analysisHistory = await res.json();

            // Update analyses count safely
            const analysesEl = document.getElementById("analysesCount");
            if (analysesEl) analysesEl.textContent = analysisHistory.length;
        }

        // Fetch clients
        const clientsResponse = await apiFetch(`${API_BASE_URL}/clients/table-data`);
        if (clientsResponse.ok) {
            const clients = await clientsResponse.json();
            const activeClients = clients.filter(client => client.status === 'active');

            const clientsEl = document.getElementById("clientsCount");
            if (clientsEl) clientsEl.textContent = activeClients.length;
        }

    } catch (error) {
        console.error("Error loading dashboard stats:", error);
    }
}


        // History functionality
        async function loadHistory() {
            const historyTable = document.getElementById('history_table');
            const userFilter = document.getElementById('user_filter');

            if (!historyTable) return;

            historyTable.innerHTML = '<div class="text-center p-4">Loading history...</div>';

            try {
                let items = analysisHistory;

                const selectedUserId = userFilter ? userFilter.value : 'all';

                // 🔹 Apply user filter
               
                if (selectedUserId !== 'all') {
                    // Show only selected user’s history (admin or regular user)
                    items = items.filter(x => x.created_by === selectedUserId);
                }



                // 🔹 Apply current month filter
                const now = new Date();
                const currentMonth = now.getMonth();  // 0 = Jan
                const currentYear = now.getFullYear();

                items = items.filter(x => {
                    if (!x.timestamp) return false;
                    const date = new Date(x.timestamp);
                    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                });

                // 🔹 Sort newest first
                items.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || '')).reverse();

                if (items.length === 0) {
                    historyTable.innerHTML = '<div class="text-center p-4">No analysis history found for this month</div>';
                    return;
                }

                // 🔹 Build table rows
                const rows = items.map((h, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${h.candidate_name || 'N/A'}</td>
                        <td>${h.candidate_email || 'N/A'}</td>
                        <td>${h.candidate_mobile || 'N/A'}</td>
                        <td>${h.client_name || 'N/A'}</td>
                        <td>${h.jd_title || 'N/A'}</td>
                        <td>${h.required_experience || 'N/A'} Years</td>
                        <td>${h.total_experience || 'N/A'}</td>
                        <td style="text-align: center;">${h.experience_match ? '✅' : '❌'}</td>
                        <td style="text-align: center;">${h.frequent_hopper ? '✅' : '❌'}</td>
                        <td>${h.match_score ?? 'N/A'}</td>
                        <td>${h.filename || 'N/A'}</td>
                        <td>${h.page_count || 'N/A'}</td>
                        <td>${formatDate(h.timestamp)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="downloadResume('${h.analysis_id}')">
                                <i class="fa fa-download"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

                // 🔹 Render table
                historyTable.innerHTML = `
                    <div class="table-responsive">
                        <table id="historyTable" class="table table-striped table-bordered">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Candidate Name</th>
                                    <th>Email</th>
                                    <th>Mobile</th>
                                    <th>Client</th>
                                    <th>Job Description</th>
                                    <th>Required <br> Experience</th>
                                    <th>Candidate <br> Experience</th>
                                    <th>Experience <br> Match</th>
                                    <th>Frequent <br> Hopper</th>
                                    <th>Score</th>
                                    <th>File Name</th>
                                    <th>Parsed <br> Pages</th>
                                    <th>Parsed Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;

                // 🔹 Initialize DataTable
                $('#historyTable').DataTable({
                    pageLength: 10,
                    lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
                    language: { lengthMenu: "_MENU_" },
                    order: [],
                    columnDefs: [
                        { orderable: true, targets: [0, 1, 9, 11, 12] }, // Adjust indices for new column
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
                            title: 'Analysis_History_' + (() => {
                                const today = new Date();
                                const day = String(today.getDate()).padStart(2, '0');
                                const month = String(today.getMonth() + 1).padStart(2, '0');
                                const year = today.getFullYear();
                                return `${day}-${month}-${year}`;
                            })(),
                            sheetName: 'analysis_history',
                            exportOptions: {
                                columns: ':not(:last-child)',
                                format: {
                                    body: function (data, row, column, node) {
                                        if (typeof data === 'string') {
                                            if (data.includes('✅')) return 'Yes';
                                            if (data.includes('❌')) return 'No';
                                        }
                                        if (data === true || data === 1) return 'Yes';
                                        if (data === false || data === 0 || data == null) return 'No';
                                        return data;
                                    }
                                }
                            }
                        },
                        {
                            extend: 'pdfHtml5',
                            text: '<i class="fa fa-file-pdf text-danger"></i>',
                            title: 'Analysis_History_' + (() => {
                                const today = new Date();
                                const day = String(today.getDate()).padStart(2, '0');
                                const month = String(today.getMonth() + 1).padStart(2, '0');
                                const year = today.getFullYear();
                                return `${day}-${month}-${year}`;
                            })(),
                            orientation: 'landscape',
                            pageSize: 'A3',
                            exportOptions: { columns: ':not(:last-child)' },
                            customize: function (doc) {
                                doc.styles.tableHeader = {
                                    fillColor: '#f2f2f2',
                                    color: 'black',
                                    alignment: 'left',
                                    bold: true
                                };
                                doc.defaultStyle.fontSize = 8;

                                // ✅ Convert all checkmarks/cross/boolean to Yes/No
                                doc.content[1].table.body.forEach((row, i) => {
                                    if (i === 0) return; // Skip header row
                                    row.forEach(cell => {
                                        if (cell.text) {
                                            let t = cell.text.toString().trim();
                                            if (t.includes('✅') || t === 'true' || t === '1') cell.text = 'Yes';
                                            else if (t.includes('❌') || t === 'false' || t === '0' || t === '' || t === 'null' || t === 'undefined') cell.text = 'No';
                                        }
                                    });
                                });

                                // Table layout customization
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

                                doc.pageMargins = [20, 20, 20, 30];
                                doc['footer'] = (currentPage, pageCount) => ({
                                    text: currentPage.toString() + ' / ' + pageCount,
                                    alignment: 'right',
                                    margin: [0, 0, 20, 0]
                                });
                            }
                        },
                        {
                            extend: 'print',
                            text: '<i class="fa fa-print text-primary"></i>',
                            title: 'Analysis_History_' + (() => {
                                const today = new Date();
                                const day = String(today.getDate()).padStart(2, '0');
                                const month = String(today.getMonth() + 1).padStart(2, '0');
                                const year = today.getFullYear();
                                return `${day}-${month}-${year}`;
                            })(),
                            exportOptions: {
                                columns: ':not(:last-child)',
                                format: {
                                    body: function (data, row, column, node) {
                                        if (typeof data === 'string') {
                                            if (data.includes('✅')) return 'Yes';
                                            if (data.includes('❌')) return 'No';
                                        }
                                        if (data === true || data === 1) return 'Yes';
                                        if (data === false || data === 0 || data == null) return 'No';
                                        return data;
                                    }
                                }
                            }
                        }
                    ]
                });

            } catch (e) {
                console.error('Error loading history:', e);
                historyTable.innerHTML = '<div class="alert alert-danger">Failed to load history</div>';
            }
        }



        // Download resume file
        function getAuthToken() {
            // Implement based on your auth system
            return localStorage.getItem('access_token');
        }
        async function downloadResume(analysisId) {
            try {
                const response = await apiFetch(`${API_BASE_URL}/download/${analysisId}`, {
                });
                
                if (!response.ok) {
                    throw new Error('Failed to download file');
                }
                
                // Get filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'resume.pdf';
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                    if (filenameMatch.length > 1) filename = filenameMatch[1];
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Download error:', error);
                alert('Failed to download file');
            }
        }

        // Filter history based on search input
        function filterHistory() {
            loadHistory();
        }
        function filterHistory_report(){
            loadHistory_report();
        }

        // Format date for display
        function formatDate(iso) {
            if (!iso) return 'N/A';
            try {
                const d = new Date(iso);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0'); // months are 0-based
                const year = d.getFullYear();
                return `${day}-${month}-${year}`;
            } catch {
                return iso;
            }
        }


        function showMessage(message, type) {
            // Create a temporary alert element
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} fixed-top mx-auto mt-3`;
            alertDiv.style.maxWidth = '500px';
            alertDiv.style.zIndex = '1100';
            alertDiv.style.animation = 'fadeIn 0.3s ease-out';
            alertDiv.innerHTML = `
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2"></i>
                ${message}
            `;
            
            document.body.appendChild(alertDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                alertDiv.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(alertDiv);
                }, 300);
            }, 5000);
        }
        
        function logout() {
            localStorage.clear();
            // window.location.href = "index.html";
            window.location.href = "/ui";
        }
// company logs ----------------------
async function loadCompanyAuditLogs() {
    const stats = document.getElementById('dashboardStats');
    if (stats) stats.style.display = 'none';

    const dataTitle = document.getElementById('dataSectionTitle');
    if (dataTitle) dataTitle.textContent = 'Audit Logs';

    const filterContainer = document.getElementById('dataFilterDropdownContainer');
    if (filterContainer) filterContainer.style.display = 'none';

    const content = document.getElementById('dataContent');
    if (content) {
        content.innerHTML = `<div class="text-center p-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading audit logs...</p>
        </div>`;
    }

    try {
        const response = await apiFetch(`${API_BASE_URL}/audit-logs/company`);
        if (response.ok) {
            const data = await response.json();
            if (content) displayAuditLogs(data.logs || []); // reuse the same table function
        } else {
            throw new Error('Failed to load audit logs');
        }
    } catch (error) {
        console.error('Error loading company audit logs:', error);
        if (content) content.innerHTML = `<div class="alert alert-danger">Failed to load audit logs: ${error.message}</div>`;
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
        let istTime = '-';
        if (log.timestamp) {
            const utcDate = new Date(log.timestamp);
            const istOffsetMs = 5.5 * 60 * 60 * 1000;
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

        const oldDataObj = log.old_data || {};
        const newDataObj = log.new_data || {};
        const fieldNames = Array.from(new Set([...Object.keys(oldDataObj), ...Object.keys(newDataObj)]));

        if (fieldNames.length === 0) {
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

    if ($.fn.DataTable.isDataTable('#auditLogsTable')) {
        $('#auditLogsTable').DataTable().destroy();
    }

    $('#auditLogsTable').DataTable({
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[6, 'asc']],
        language: {
            search: "Search logs:",
            lengthMenu: "Show _MENU_ logs per page",
            info: "Showing _START_ to _END_ of _TOTAL_ logs",
            infoEmpty: "No logs available",
            infoFiltered: "(filtered from _MAX_ total logs)"
        }
    });
}
