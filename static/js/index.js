async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const messageDiv = document.getElementById("message");
    const loadingDiv = document.getElementById("loading");

    if (!email || !password) {
        showMessage("Please fill in all fields", "error");
        return;
    }

    loadingDiv.style.display = "block";
    messageDiv.style.display = "none";

    try {
        const response = await fetch("http://127.0.0.1:8000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // ✅ Store all user data securely
            const userData = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                role: data.role,
                user_id: data.user_id || data.id,
                email: data.email,
                company_id: data.company_id || "",
                name: data.name || ""
            };

            // Save tokens & user details in localStorage
            localStorage.setItem("userData", JSON.stringify(userData));
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);
            localStorage.setItem("userRole", data.role);
            localStorage.setItem("userId", data.user_id || data.id);
            localStorage.setItem("companyId", data.company_id || "");
            localStorage.setItem("name", data.name || "");

            showMessage("Login successful! Redirecting...", "success");

            // ✅ Redirect based on user role
            setTimeout(() => {
                switch (data.role) {
                    case "super_admin":
                        // window.location.href = "super-admin-dashboard.html";
                        window.location.href = "/super-admin-dashboard";
                        break;
                    case "company_admin":
                        window.location.href = "/company-dashboard";
                        break;
                    case "user":
                        window.location.href = "/user-dashboard";
                        break;
                    default:
                        window.location.href = "/dashboard";
                }
            }, 1500);
        } else {
            showMessage(data.detail || "Login failed", "error");
        }
    } catch (error) {
        console.error("Login error:", error);
        showMessage("Network error. Please try again.", "error");
    } finally {
        loadingDiv.style.display = "none";
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById("message");
    messageDiv.innerText = message;
    messageDiv.className = type;
    messageDiv.style.display = "block";
}

// Allow Enter key to submit
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});


function openResetModal(){
  document.getElementById('resetModal').style.display='block';
  // Clear previous inputs and messages
  document.getElementById('resetEmail').value = '';
  document.getElementById('resetNewPassword').value = '';
  document.getElementById('resetConfirmPassword').value = '';
  document.getElementById('resetMsg').innerText = '';
}

function closeResetModal(){
  document.getElementById('resetModal').style.display='none';
}

async function requestReset(){
  const email = (document.getElementById('resetEmail').value||'').trim();
  const pw = (document.getElementById('resetNewPassword').value||'').trim();
  const cpw = (document.getElementById('resetConfirmPassword').value||'').trim();
  const msg = document.getElementById('resetMsg');
  msg.style.color = '#721c24';
  msg.innerText = '';
  
  if(!email||!pw||!cpw){ 
    msg.innerText = 'All fields are required.'; 
    return; 
  }
  if(pw.length<6){ 
    msg.innerText = 'Password must be at least 6 characters.'; 
    return; 
  }
  if(pw!==cpw){ 
    msg.innerText = 'Passwords do not match.'; 
    return; 
  }
  
  try {
    const res = await fetch('http://127.0.0.1:8000/password-reset/request', {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: email, new_password: pw })
    });
    
    if (res.ok) {
      // Show success message and close modal after delay
      msg.style.color = '#155724';
      msg.innerText = 'Password reset link sent to your email!';
      
      // Close modal after 2 seconds
      setTimeout(() => {
        closeResetModal();
      }, 2000);
    } else {
      const error = await res.text();
      msg.style.color = '#721c24';
      msg.innerText = 'Failed: ' + error;
    }
  } catch(e) { 
    msg.innerText = 'Network error: ' + e.message; 
  }
}
async function confirmReset(){
  const token = (document.getElementById('resetToken').value||'').trim();
  const msg = document.getElementById('resetMsg');
  msg.style.color = '#721c24';
  msg.innerText = '';
  if(!token){ msg.innerText = 'Token is required.'; return; }
  try{
    const res = await fetch(`http://127.0.0.1:8000/password-reset/confirm/${token}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: token })
    });
    const txt = await res.text();
    msg.style.color = res.ok? '#155724':'#721c24';
    msg.innerText = res.ok? 'Password reset successful. You can log in now.':'Failed: '+txt;
  }catch(e){ msg.innerText = 'Network error.'; }
}
function togglePasswordVisibility(inputId, iconId){
    const pwInput = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if(pwInput.type === "password"){
        pwInput.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }else{
        pwInput.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

// Attach eye toggle events
document.getElementById("toggleLoginPw").addEventListener("click",()=>togglePasswordVisibility("password","toggleLoginPw"));
document.getElementById("toggleResetPw1").addEventListener("click",()=>togglePasswordVisibility("resetNewPassword","toggleResetPw1"));
document.getElementById("toggleResetPw2").addEventListener("click",()=>togglePasswordVisibility("resetConfirmPassword","toggleResetPw2"));

