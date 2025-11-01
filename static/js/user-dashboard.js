const API_BASE_URL = 'http://0.0.0.0:8000';
        const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB in bytes
        const ALLOWED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        let userData = null;
        let companyData = null;
        let analysisHistory = [];
        function updateSidebarLogo(completeUserData1) {
    const sidebarLogo = document.getElementById('sidebarCompanyLogo');

    if (completeUserData1 && completeUserData1.profile_photo_url) {
        sidebarLogo.src = `${API_BASE_URL}${completeUserData1.profile_photo_url}`;
    } else {
        sidebarLogo.src = "static/logo3.png"; // fallback default
    }

    // Fallback if the image fails to load
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
            if (userData.role !== "user") {
                window.location.href = "/ui";
                return;
            }

            document.getElementById("userName").textContent = userData.name;
            document.getElementById("userInitial").textContent = userData.name.charAt(0).toUpperCase();
            loadUserData();
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
    document.getElementById('dataSectionTitle').textContent = 'User Data';
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
    const selectedYear = parseInt(document.getElementById('chartYear').value);
    
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYearNow = currentDate.getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const labels = [];
        const monthCount = selectedYear === currentYearNow ? currentMonth + 1 : 12;
        for (let i = 0; i < monthCount; i++) {
            labels.push(`${monthNames[i]} ${selectedYear}`);
        }

        const userPages = [];
        for (let month = 0; month < monthCount; month++) {
            const pages = analysisHistory
                .filter(a => {
                    if (!a.timestamp) return false;
                    const d = new Date(a.timestamp);
                    return (
                        d.getMonth() === month &&
                        d.getFullYear() === selectedYear &&
                        a.created_by === userData.user_id   // ✅ only current user
                    );
                })
                .reduce((sum, a) => sum + (a.page_count || 0), 0);
            userPages.push(pages);
        }

        const datasets = [{
            label: `Count`,
            data: userPages,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.9
        }];

        const ctx = document.getElementById('pagesChart').getContext('2d');
        if (pagesChart) pagesChart.destroy();
        pagesChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Pages' } },
                    x: { title: { display: true, text: 'Months' } }
                },
                plugins: {
                    title: { display: true, text: `Pages Parsed in ${selectedYear}` },
                    legend: { display: false } // Only one user
                }
            }
        });
    } catch (err) {
        console.error('Error updating chart:', err);
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
                        
                        
                        
                    </div>
                    <div id="history_table" class="table"></div>
                </div>
            `;

            // Load history data and populate user filter
            loadHistory();
            // populateUserFilter();
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
                

                <!-- Client Filter -->
                <div style="min-width: 180px;">
                    <label class="small mb-1">Clients</label>
                    <select id="client_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Clients</option>
                    </select>
                </div>

                <!-- JD Filter -->
                <div style="min-width: 180px;">
                    <label class="small mb-1">Job Description</label>
                    <select id="jd_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Job Descriptions</option>
                    </select>
                </div>

                <!-- Experience Match -->
                <div style="min-width: 180px;">
                    <label class="small mb-1">Experience Match</label>
                    <select id="exp_match_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All</option>
                        <option value="true">Matched</option>
                        <option value="false">Unmatched</option>
                    </select>
                </div>

                <!-- Score Range -->
                <div style="min-width: 180px;">
                    <label class="small mb-1">Score Range</label>
                    <select id="score_filter" class="form-control form-control-sm" onchange="filterHistory_report()">
                        <option value="all">All Scores</option>
                        <option value="0-50">0 - 50</option>
                        <option value="51-70">51 - 70</option>
                        <option value="71-100">71 - 100</option>
                    </select>
                </div>

                <!-- Date Range -->
                <div style="min-width: 180px;">
                    <label class="small mb-1">From Date</label>
                    <input type="date" id="from_date" class="form-control form-control-sm" onchange="filterHistory_report()">
                </div>
                
                <div style="min-width: 180px;">
                    <label class="small mb-1">To Date</label>
                    <input type="date" id="to_date" class="form-control form-control-sm" onchange="filterHistory_report()">
                </div>
            </div>

            <div id="history_table" class="table"></div>
        </div>
    `;

    // Load data
    loadHistory_report();
    //populateUserFilter_report();
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
                { orderable: true, targets: [0, 1, 8, 10, 11] },
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
                    title: 'Analysis_Report_' + (() => {
                        const today = new Date();
                        const day = String(today.getDate()).padStart(2, '0');
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const year = today.getFullYear();
                        return `${day}-${month}-${year}`;
                    })(),
                    sheetName: 'Analysis Report',
                    exportOptions: {
                        format: {
                            body: function (data, row, column, node) {
                                return data === '✅' ? 'Yes' : (data === '❌' ? 'No' : data);
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
                            exportOptions: { 
                                columns: [0,1,2,3,4,5,6,7,8,9,10,11,12,13] // All columns except action
                            },
                            customize: function (doc) {
                                doc.styles.tableHeader = {
                                    fillColor: '#f2f2f2',
                                    color: 'black',
                                    alignment: 'left',
                                    bold: true
                                };
                                doc.defaultStyle.fontSize = 7; // Slightly smaller font to fit more columns
                                doc.content[1].table.widths = [
                                    '3%',  // S.No
                                    '12%', // Candidate Name
                                    '12%', // Email
                                    '10%', // Mobile
                                    '10%', // Client
                                    '12%', // Job Description
                                    '6%',  // Required Experience
                                    '6%',  // Candidate Experience
                                    '5%',  // Experience Match
                                    '5%',  // Frequent Hopper
                                    '4%',  // Score
                                    '8%',  // File Name
                                    '3%',  // Parsed Pages
                                    '7%'   // Parsed Date
                                ];

                                // Add custom layout
                                doc.content[1].layout = {
                                    hLineWidth: function (i, node) {
                                        if (i === 1) return 2;  // Thick bottom border for header row
                                        return 0.5;            // Thin horizontal borders elsewhere
                                    },
                                    vLineWidth: function (i, node) {
                                        return 0.5;           // Thin vertical borders
                                    },
                                    hLineColor: function (i, node) {
                                        return 'black';       // Dark black border color
                                    },
                                    vLineColor: function (i, node) {
                                        return 'black';       // Dark black border color
                                    },
                                    paddingLeft: function(i, node) { return 4; },
                                    paddingRight: function(i, node) { return 4; },
                                    paddingTop: function(i, node) { return 2; },
                                    paddingBottom: function(i, node) { return 2; }
                                };

                                var rowCount = doc.content[1].table.body.length;
                                for (var i = 1; i < rowCount; i++) {
                                    // Convert icons to text
                                    let expMatch = doc.content[1].table.body[i][8].text;
                                    if (expMatch.includes("✅")) doc.content[1].table.body[i][8].text = "Yes";
                                    else if (expMatch.includes("❌")) doc.content[1].table.body[i][8].text = "No";

                                    let freqHopper = doc.content[1].table.body[i][9].text;
                                    if (freqHopper.includes("✅")) doc.content[1].table.body[i][9].text = "Yes";
                                    else if (freqHopper.includes("❌")) doc.content[1].table.body[i][9].text = "No";

                                    // Center align specific columns
                                    doc.content[1].table.body[i][7].alignment = 'center'; // Candidate Experience
                                    doc.content[1].table.body[i][8].alignment = 'center'; // Experience Match
                                    doc.content[1].table.body[i][9].alignment = 'center'; // Frequent Hopper
                                    doc.content[1].table.body[i][10].alignment = 'center'; // Score
                                    doc.content[1].table.body[i][12].alignment = 'center'; // Parsed Pages
                                    doc.content[1].table.body[i][13].alignment = 'center'; // Parsed Date
                                }

                                doc.pageMargins = [15, 15, 15, 25]; // Tighter margins for more columns

                                doc['footer'] = function(currentPage, pageCount) {
                                    return { 
                                        text: currentPage.toString() + ' / ' + pageCount, 
                                        alignment: 'right', 
                                        margin: [0, 0, 15, 0] 
                                    };
                                };
                            }
                        },
                {
                    extend: 'print',
                    text: '<i class="fa fa-print text-primary"></i>',
                    title: 'Analysis_Report_' + (() => {
                        const today = new Date();
                        const day = String(today.getDate()).padStart(2, '0');
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const year = today.getFullYear();
                        return `${day}-${month}-${year}`;
                    })(),
                    exportOptions: {
                        format: {
                            body: function (data, row, column, node) {
                                return data === '✅' ? 'Yes' : (data === '❌' ? 'No' : data);
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


function showUserInfo() {
    document.getElementById('dashboardStats').style.display = 'none';
    setActiveLink('user-info');
    document.getElementById('dataSectionTitle').textContent = 'My Profile';
    document.getElementById('dataFilterDropdownContainer').style.display = 'none';

    const content = document.getElementById('dataContent');

    // Show loading state
    content.innerHTML = `
        <div class="text-center p-4">
            <div class="loading-spinner"></div>
            <p>Loading profile information...</p>
        </div>
    `;

    fetchUserData();
    loadUserData();
}

async function fetchUserData() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/users/${userData.user_id}`);
        if (!response.ok) throw new Error('Failed to fetch user data');

        const completeUserData = await response.json();
        renderUserInfo(completeUserData);

    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('dataContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load profile information: ${error.message}
            </div>
        `;
    }
}

function renderUserInfo(userData) {
    const content = document.getElementById('dataContent');

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        } catch {
            return dateString;
        }
    };

    const fullName = [userData.name, userData.middle_name, userData.last_name].filter(n => n).join(' ');

    content.innerHTML = `
        <div class="container">
            <!-- Header & Avatar -->
            <div class="text-center mb-4">
                <label for="profileUpload" style="cursor: pointer;">
                    ${userData.profile_photo_url 
                        ? `<img src="${API_BASE_URL}${userData.profile_photo_url}" 
                                alt="Profile Photo" 
                                class="rounded-circle shadow-sm" 
                                style="width:120px; height:120px; object-fit:cover;">`
                        : `<div class="rounded-circle bg-light d-flex align-items-center justify-content-center shadow-sm"
                                style="width:120px; height:120px;">
                                <span class="text-muted">No Photo</span>
                           </div>`}
                </label>
                <input type="file" id="profileUpload" accept="image/jpeg,image/png,image/gif" style="display:none;">
                <div class="form-text mt-2">Add Photo</div>
                <h4 class="mt-3 mb-0">${fullName || 'Not specified'}</h4>
            </div>

            <!-- Personal Info (View Only) -->
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-control" value="${userData.name || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Middle Name</label>
                    <input type="text" class="form-control" value="${userData.middle_name || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-control" value="${userData.last_name || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" value="${userData.email || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Mobile</label>
                    <input type="text" class="form-control" value="${userData.mobile || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Gender</label>
                    <input type="text" class="form-control" value="${userData.gender || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Date of Birth</label>
                    <input type="text" class="form-control" value="${formatDate(userData.dob)}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Department</label>
                    <input type="text" class="form-control" value="${userData.department || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Designation</label>
                    <input type="text" class="form-control" value="${userData.designation || ''}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Date of Joining</label>
                    <input type="text" class="form-control" value="${formatDate(userData.date_of_joining)}" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Status</label>
                    <input type="text" class="form-control" value="${userData.status || ''}" readonly>
                </div>
            </div>
        </div>
    `;

    // Set up profile upload
    document.getElementById('profileUpload').addEventListener('change', () => {
    uploadUserProfile(userData.id);
});

}

async function uploadUserProfile(id) {
    const fileInput = document.getElementById('profileUpload');
    const file = fileInput.files[0];
    if (!file) return;

    // ✅ Validate file before sending
    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
        alert("Only JPEG, PNG, and GIF files are allowed.");
        fileInput.value = "";
        return;
    }
    if (file.size > 1024 * 1024) { // 1 MB limit
        alert("File size must be less than 1 MB.");
        fileInput.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await apiFetch(`${API_BASE_URL}/users/${id}/profile-photo`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Failed to upload photo");
        }

        const result = await response.json();
        // ✅ Update profile image without reload
        const imgElement = document.querySelector("#dataContent img");
        if (imgElement) {
            imgElement.src = `${API_BASE_URL}${result.profile_photo_url}?t=${Date.now()}`;
        }

        alert("Profile photo updated successfully!");
        fileInput.value = ""; // Reset input
    } catch (err) {
        console.error("Error uploading profile photo:", err);
        alert("Error uploading profile photo: " + err.message);
    }
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
                }
            } catch (error) {
                console.error("Error loading company data:", error);
            }
        }
        async function loadUserData() {
            try {
        const response = await apiFetch(`${API_BASE_URL}/users/${userData.user_id}`);
        if (!response.ok) throw new Error('Failed to fetch user data');

        const completeUserData1 = await response.json();
       
        updateSidebarLogo(completeUserData1);

    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('dataContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load profile information: ${error.message}
            </div>
        `;
    }
        }
        async function authFetch(url, options = {}) {
            // Get user data from localStorage
            const userData = JSON.parse(localStorage.getItem("userData") || "{}");
            const token = localStorage.getItem("userToken");
            const role = userData.role || userData?.role;
            const userId = userData.user_id || userData?.user_id || userData.id || userData?.id;
            const companyId = userData.company_id || userData?.company_id || "";
            
            // Set headers
            options.headers = {
                ...options.headers,
                "X-User-Role": role,
                "X-User-Id": userId,
                "X-Company-Id": companyId
            };
            
            if (token) {
                options.headers.Authorization = `Bearer ${token}`;
            }
            
            const response = await fetch(url, options);
            
            // Handle unauthorized responses
            if (response.status === 401) {
                localStorage.removeItem("userData");
                localStorage.removeItem("userToken");
                window.location.href = "login.html";
                throw new Error("Unauthorized - redirecting to login");
            }
            
            return response;
        }
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

    let json;
    try {
        json = await resp.json();
    } catch (_) {
        json = null;
    }

    if (!resp.ok) {
        // Show FastAPI error message if present
        const errMsg = json?.detail || `Server returned ${resp.status}: ${resp.statusText}`;
        throw new Error(errMsg);
    }

    // Success
    renderAnalysis(json);
    loadAnalysisHistory();

} catch (err) {
    console.error('Analysis error:', err);
    analysisContainer.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${err.message}
      </div>
    `;
    analysisContainer.classList.remove('hidden');
}finally {
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
                            <div class="metric-title">Candidate’s Experience</div>
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
                        { orderable: true, targets: [0, 1, 10, 12, 13] }, // Updated indices
                        { orderable: false, targets: '_all' },
                        { width: "auto", targets: "_all" },
                        { 
                            targets: [8, 9], // Experience Match & Frequent Hopper columns
                            className: 'dt-center' // Center align these columns
                        }
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
                                columns: ':not(:last-child)', // Exclude action column
                                format: {
                                    body: function (data, row, column, node) {
                                        // Convert icons to text for Excel
                                        if (data.includes('✅')) return 'Yes';
                                        if (data.includes('❌')) return 'No';
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
                            exportOptions: { 
                                columns: [0,1,2,3,4,5,6,7,8,9,10,11,12,13] // All columns except action
                            },
                            customize: function (doc) {
                                doc.styles.tableHeader = {
                                    fillColor: '#f2f2f2',
                                    color: 'black',
                                    alignment: 'left',
                                    bold: true
                                };
                                doc.defaultStyle.fontSize = 7; // Slightly smaller font to fit more columns
                                doc.content[1].table.widths = [
                                    '3%',  // S.No
                                    '12%', // Candidate Name
                                    '12%', // Email
                                    '10%', // Mobile
                                    '10%', // Client
                                    '12%', // Job Description
                                    '6%',  // Required Experience
                                    '6%',  // Candidate Experience
                                    '5%',  // Experience Match
                                    '5%',  // Frequent Hopper
                                    '4%',  // Score
                                    '8%',  // File Name
                                    '3%',  // Parsed Pages
                                    '7%'   // Parsed Date
                                ];

                                // Add custom layout
                                doc.content[1].layout = {
                                    hLineWidth: function (i, node) {
                                        if (i === 1) return 2;  // Thick bottom border for header row
                                        return 0.5;            // Thin horizontal borders elsewhere
                                    },
                                    vLineWidth: function (i, node) {
                                        return 0.5;           // Thin vertical borders
                                    },
                                    hLineColor: function (i, node) {
                                        return 'black';       // Dark black border color
                                    },
                                    vLineColor: function (i, node) {
                                        return 'black';       // Dark black border color
                                    },
                                    paddingLeft: function(i, node) { return 4; },
                                    paddingRight: function(i, node) { return 4; },
                                    paddingTop: function(i, node) { return 2; },
                                    paddingBottom: function(i, node) { return 2; }
                                };

                                var rowCount = doc.content[1].table.body.length;
                                for (var i = 1; i < rowCount; i++) {
                                    // Convert icons to text
                                    let expMatch = doc.content[1].table.body[i][8].text;
                                    if (expMatch.includes("✅")) doc.content[1].table.body[i][8].text = "Yes";
                                    else if (expMatch.includes("❌")) doc.content[1].table.body[i][8].text = "No";

                                    let freqHopper = doc.content[1].table.body[i][9].text;
                                    if (freqHopper.includes("✅")) doc.content[1].table.body[i][9].text = "Yes";
                                    else if (freqHopper.includes("❌")) doc.content[1].table.body[i][9].text = "No";

                                    // Center align specific columns
                                    doc.content[1].table.body[i][7].alignment = 'center'; // Candidate Experience
                                    doc.content[1].table.body[i][8].alignment = 'center'; // Experience Match
                                    doc.content[1].table.body[i][9].alignment = 'center'; // Frequent Hopper
                                    doc.content[1].table.body[i][10].alignment = 'center'; // Score
                                    doc.content[1].table.body[i][12].alignment = 'center'; // Parsed Pages
                                    doc.content[1].table.body[i][13].alignment = 'center'; // Parsed Date
                                }

                                doc.pageMargins = [15, 15, 15, 25]; // Tighter margins for more columns

                                doc['footer'] = function(currentPage, pageCount) {
                                    return { 
                                        text: currentPage.toString() + ' / ' + pageCount, 
                                        alignment: 'right', 
                                        margin: [0, 0, 15, 0] 
                                    };
                                };
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
                                columns: ':not(:last-child)' // Exclude action column
                            },
                            customize: function (win) {
                                $(win.document.body).find('table').addClass('print-table');
                                $(win.document.body).css('font-size', '10px');
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
        