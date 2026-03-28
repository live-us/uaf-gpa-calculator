// Service Worker Registration for PWA Offline Mode
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW Registration successful:', reg.scope);
        }).catch(err => {
            console.log('SW Registration failed:', err);
        });
    });
}

// UAF Grade Points Mapping
const GRADE_POINTS = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D': 1.0, 'F': 0.0
};

// Application State
let semestersData = [];
let calculateTimeout;

// DOM Elements
const semestersWrapper = document.getElementById('semesters-wrapper');
const semesterTemplate = document.getElementById('semester-template');
const courseTemplate = document.getElementById('course-template');
const overallCgpaEl = document.getElementById('overall-cgpa');
const overallCreditsEl = document.getElementById('overall-credits');
const standingBadge = document.getElementById('standing-badge');
const appLoader = document.getElementById('app-loader');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Hide loader
    setTimeout(() => {
        appLoader.style.opacity = '0';
        setTimeout(() => appLoader.remove(), 500);
    }, 800);

    initTheme();
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('add-semester-btn').addEventListener('click', () => addSemester());
    document.getElementById('clear-all-btn').addEventListener('click', confirmClearAll);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Preset dropdown
    document.getElementById('preset-selector').addEventListener('change', (e) => loadPreset(e.target.value));

    // Export Buttons
    document.getElementById('export-img-btn').addEventListener('click', exportAsImage);
    document.getElementById('export-pdf-btn').addEventListener('click', () => window.print());

    // Modals
    setupModals();
}

/* =======================================
   STATE & LOCAL STORAGE
======================================= */
function saveData() {
    // Update data array based on DOM structure
    semestersData = [];
    const semesterCards = document.querySelectorAll('.semester-card');
    
    semesterCards.forEach((card, semIndex) => {
        const title = card.querySelector('.editable-title').innerText;
        const courses = [];
        const courseRows = card.querySelectorAll('.course-row');
        
        courseRows.forEach(row => {
            courses.push({
                name: row.querySelector('.course-name').value,
                credits: parseInt(row.querySelector('.course-credits').value),
                grade: row.querySelector('.course-grade').value
            });
        });
        
        semestersData.push({ id: Date.now() + semIndex, title, courses });
    });

    localStorage.setItem('uaf_cgpa_data', JSON.stringify(semestersData));
}

function loadData() {
    const savedData = localStorage.getItem('uaf_cgpa_data');
    if (savedData) {
        semestersData = JSON.parse(savedData);
        if (semestersData.length > 0) {
            renderSemesters();
            calculateAll();
            return;
        }
    }
    // Default Empty State - Add 1 empty semester
    addSemester('Semester 1');
}

/* =======================================
   DOM MANIPULATION
======================================= */
function renderSemesters() {
    semestersWrapper.innerHTML = '';
    semestersData.forEach((sem) => {
        const semEl = createSemesterElement(sem.title, sem.courses);
        semestersWrapper.appendChild(semEl);
    });
}

function createSemesterElement(titleStr = 'Semester', courses = []) {
    const clone = semesterTemplate.content.cloneNode(true);
    const card = clone.querySelector('.semester-card');
    const titleEl = card.querySelector('.editable-title');
    const coursesList = card.querySelector('.courses-list');
    
    titleEl.innerText = titleStr;
    titleEl.addEventListener('blur', triggerCalculation);

    // Add Course Button
    card.querySelector('.add-course-btn').addEventListener('click', () => {
        coursesList.appendChild(createCourseElement());
        triggerCalculation();
    });

    // Delete Semester Button
    card.querySelector('.delete-semester').addEventListener('click', () => {
        card.remove();
        triggerCalculation();
    });

    // Load initial courses
    if (courses.length > 0) {
        courses.forEach(c => coursesList.appendChild(createCourseElement(c)));
    } else {
        // Default 3 courses
        for(let i=0; i<3; i++) coursesList.appendChild(createCourseElement());
    }

    return card;
}

function createCourseElement(courseData = null) {
    const clone = courseTemplate.content.cloneNode(true);
    const row = clone.querySelector('.course-row');
    
    const nameInput = row.querySelector('.course-name');
    const creditSelect = row.querySelector('.course-credits');
    const gradeSelect = row.querySelector('.course-grade');

    if (courseData) {
        nameInput.value = courseData.name || '';
        creditSelect.value = courseData.credits;
        gradeSelect.value = courseData.grade;
    }

    // Event listeners to trigger calculation on change
    nameInput.addEventListener('input', triggerCalculation);
    creditSelect.addEventListener('change', triggerCalculation);
    gradeSelect.addEventListener('change', triggerCalculation);

    row.querySelector('.delete-course').addEventListener('click', () => {
        row.remove();
        triggerCalculation();
    });

    return row;
}

function addSemester(title = `Semester ${document.querySelectorAll('.semester-card').length + 1}`) {
    const semEl = createSemesterElement(title);
    semestersWrapper.appendChild(semEl);
    triggerCalculation();
}

function confirmClearAll() {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
        localStorage.removeItem('uaf_cgpa_data');
        semestersData = [];
        semestersWrapper.innerHTML = '';
        addSemester('Semester 1');
    }
}

/* =======================================
   CALCULATION ENGINE
======================================= */
function triggerCalculation() {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
        calculateAll();
        saveData();
    }, 400); // 400ms debounce
}

function calculateAll() {
    const semesterCards = document.querySelectorAll('.semester-card');
    let totalQualityPoints = 0;
    let totalCreditsAccumulated = 0;

    semesterCards.forEach(card => {
        const courseRows = card.querySelectorAll('.course-row');
        let semCredits = 0;
        let semQualityPoints = 0;

        courseRows.forEach(row => {
            const grade = row.querySelector('.course-grade').value;
            const credits = parseInt(row.querySelector('.course-credits').value) || 0;

            if (grade && GRADE_POINTS[grade] !== undefined) {
                semCredits += credits;
                semQualityPoints += (GRADE_POINTS[grade] * credits);
            }
        });

        // Update Semester Footer stats
        let semGpa = 0;
        if (semCredits > 0) {
            semGpa = semQualityPoints / semCredits;
        }
        
        card.querySelector('.sem-credits').innerText = semCredits;
        card.querySelector('.sem-gpa').innerText = semGpa.toFixed(2);

        totalCreditsAccumulated += semCredits;
        totalQualityPoints += semQualityPoints;
    });

    // Update Overall Stats
    overallCreditsEl.innerText = totalCreditsAccumulated;
    
    let cgpa = 0;
    if (totalCreditsAccumulated > 0) {
        cgpa = totalQualityPoints / totalCreditsAccumulated;
    }
    
    overallCgpaEl.innerText = cgpa.toFixed(2);
    updateStandingBadge(cgpa, totalCreditsAccumulated);
}

function updateStandingBadge(cgpa, credits) {
    if (credits === 0) {
        standingBadge.innerText = 'No Data';
        standingBadge.className = 'stat-badge badge-neutral';
        return;
    }

    if (cgpa >= 3.5) {
        standingBadge.innerText = 'Excellent Standing';
        standingBadge.className = 'stat-badge badge-success';
    } else if (cgpa >= 2.5) {
        standingBadge.innerText = 'Good Standing';
        standingBadge.className = 'stat-badge badge-success';
    } else if (cgpa >= 2.0) {
        standingBadge.innerText = 'Satisfactory';
        standingBadge.className = 'stat-badge badge-warning';
    } else {
        standingBadge.innerText = 'Probation / Warning';
        standingBadge.className = 'stat-badge badge-danger';
    }
}

/* =======================================
   TARGET CALCULATOR
======================================= */
let targetModal, shareModal;

function setupModals() {
    targetModal = document.getElementById('target-modal');
    shareModal = document.getElementById('share-modal');

    // Open Modals
    document.getElementById('target-cgpa-btn').addEventListener('click', () => {
        // Pre-fill target calculator with current data
        document.getElementById('target-current-cgpa').value = overallCgpaEl.innerText;
        document.getElementById('target-current-credits').value = overallCreditsEl.innerText;
        targetModal.classList.remove('hidden');
    });

    document.getElementById('share-btn').addEventListener('click', () => {
        shareModal.classList.remove('hidden');
    });

    // Close Modals
    document.getElementById('close-modal-btn').addEventListener('click', () => targetModal.classList.add('hidden'));
    document.getElementById('close-share-btn').addEventListener('click', () => shareModal.classList.add('hidden'));
    
    // Close on overlay click
    targetModal.addEventListener('click', (e) => {
        if(e.target === targetModal) targetModal.classList.add('hidden');
    });
    shareModal.addEventListener('click', (e) => {
        if(e.target === shareModal) shareModal.classList.add('hidden');
    });

    // Target Calculation Logic
    document.getElementById('calculate-target-btn').addEventListener('click', calculateTargetGpa);

    // Setup Share functionality
    setupShareLinks();
}

function calculateTargetGpa() {
    const currentCgpa = parseFloat(document.getElementById('target-current-cgpa').value);
    const currentCredits = parseFloat(document.getElementById('target-current-credits').value);
    const desiredCgpa = parseFloat(document.getElementById('target-desired-cgpa').value);
    const nextCredits = parseFloat(document.getElementById('target-next-credits').value);
    
    const resultBox = document.getElementById('target-result-box');
    const resultValue = document.getElementById('target-result-value');
    const resultMsg = document.getElementById('target-result-msg');

    if (isNaN(currentCgpa) || isNaN(currentCredits) || isNaN(desiredCgpa) || isNaN(nextCredits)) {
        alert("Please fill all fields accurately.");
        return;
    }

    const totalTargetPoints = desiredCgpa * (currentCredits + nextCredits);
    const currentPoints = currentCgpa * currentCredits;
    const requiredPoints = totalTargetPoints - currentPoints;
    const requiredGpa = requiredPoints / nextCredits;

    resultBox.classList.remove('hidden');

    if (requiredGpa > 4.0) {
        resultValue.innerText = "Impossible (> 4.0)";
        resultValue.style.color = "var(--danger)";
        resultMsg.innerText = "You cannot achieve this target in a single semester with these credits.";
    } else if (requiredGpa < 0) {
        resultValue.innerText = "0.00";
        resultValue.style.color = "var(--success)";
        resultMsg.innerText = "Your target is already well within reach even if you fail.";
    } else {
        resultValue.innerText = requiredGpa.toFixed(2);
        resultValue.style.color = "var(--primary-color)";
        resultMsg.innerText = "Achievable. Stay focused!";
    }
}

/* =======================================
   EXPORT & SHARE
======================================= */
function exportAsImage() {
    const exportBtn = document.getElementById('export-img-btn');
    const originalIcon = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    const element = document.getElementById('export-section');
    
    html2canvas(element, {
        scale: 2,
        backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff',
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `UAF_CGPA_Result_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        exportBtn.innerHTML = originalIcon;
    }).catch(err => {
        console.error("Export failed", err);
        alert("Failed to export image.");
        exportBtn.innerHTML = originalIcon;
    });
}

function setupShareLinks() {
    const url = encodeURIComponent("https://liveuafgpa.netlify.app/");
    const text = encodeURIComponent("Hey! Check out this awesome UAF CGPA Calculator I use to track my grades! 🎓");
    
    document.getElementById('share-wa').href = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    document.getElementById('share-email').href = `mailto:?subject=UAF%20CGPA%20Calculator&body=${text}%20${url}`;
    
    const copyBtn = document.getElementById('copy-link-btn');
    copyBtn.addEventListener('click', () => {
        const linkInput = document.getElementById('share-link-input');
        linkInput.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => copyBtn.innerHTML = originalText, 2000);
    });
}

/* =======================================
   THEMING & PRESETS
======================================= */
function initTheme() {
    const savedTheme = localStorage.getItem('uaf_theme') || 'light';
    setTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setTheme(themeName) {
    if (themeName === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.className = 'dark-mode';
        document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.className = 'light-mode';
        document.getElementById('theme-toggle').innerHTML = '<i class="fa-regular fa-moon"></i>';
    }
    localStorage.setItem('uaf_theme', themeName);
}

function loadPreset(preset) {
    if(!preset) return;
    
    if(!confirm("Loading a preset will clear your current entries. Continue?")) {
        document.getElementById('preset-selector').value = "";
        return;
    }
    
    semestersData = [];
    semestersWrapper.innerHTML = '';
    
    // Example preset data (can be expanded)
    if(preset === 'agriculture') {
        const sem1 = createSemesterElement('Semester 1 (Agri Core)');
        const sem2 = createSemesterElement('Semester 2 (Agri Core)');
        semestersWrapper.appendChild(sem1);
        semestersWrapper.appendChild(sem2);
    } else if (preset === 'sciences') {
        const sem1 = createSemesterElement('1st Semester (Sciences)');
        semestersWrapper.appendChild(sem1);
    } else if (preset === 'engineering') {
        for(let i=1; i<=8; i++) {
            semestersWrapper.appendChild(createSemesterElement(`Semester ${i}`));
        }
    } else if (preset === 'veterinary') {
        for(let i=1; i<=10; i++) {
            semestersWrapper.appendChild(createSemesterElement(`Semester ${i}`));
        }
    }
    
    document.getElementById('preset-selector').value = "";
    triggerCalculation();
}
