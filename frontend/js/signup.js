const MODE = 'DEV';

const host =  window.location.protocol + "//" + window.location.host;
const devApiHost = 'http://localhost';
const prodApiHost = 'http://134.125.44.31';
const apiHost = (MODE === 'DEV') ? devApiHost : prodApiHost;

const form = document.querySelector('#signup-form');
const submitBtn = document.querySelector('.submit-btn');
const loginRef = document.querySelector('#login-ref');

document.addEventListener("DOMContentLoaded", e => {
     loginRef.setAttribute("href", host + "/login.html");
});

const handleFetchError = async (response) => {
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) {
        const errmsg = json.errors[0]
        // создаём исключением и записываем туда сообщение об ошибке, если статус не 2хх
        let err = new Error("HTTP status code: " + response.status + "\nMessage: " + errmsg)
        err.response = response
        err.status = response.status
        throw err
    }
    return json;
}
function showToast(isError, payload) {
    let toast;
    if (isError){
        toast = document.querySelector('.toast--error');
    } else {
        toast = document.querySelector(".toast--ok");
    }
    toast.innerHTML = payload;
    toast.classList.add("toast--active");
    setTimeout(() => {
        toast.classList.remove("toast--active");
    }, 5000);
}


submitBtn.addEventListener('click', e => {
    e.preventDefault();
    let body = {
        email: form.querySelector('#email').value,
        fullName: form.querySelector('#fullName').value,
        phone: form.querySelector('#phone').value,
        password: form.querySelector('#password').value,
        confirmationPassword: form.querySelector('#confirmationPassword').value
    };
    body.isCourier = form.querySelector('#courier-rbtn').checked;
    body = JSON.stringify(body);
    fetch(`${apiHost}/api/auth/signup/`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body: body
    })
    .then(handleFetchError)
    .then(response_data => {
        if (localStorage.getItem("access") !== null){
            localStorage.removeItem("access");
        }
        if (localStorage.getItem("isCourier") !== null){
            localStorage.removeItem("isCourier");
        }
        localStorage.setItem("access", response_data.access);
        localStorage.setItem("isCourier", response_data.isCourier);
        setTimeout(() => {
            if (response_data.isCourier) {
                location.replace(host + '/courier.html');
            } else {
                location.replace(host + '/customer.html');
            }
        }, 1000);
    })
    .catch(err => {
        showToast(true, err.message);
    });
});