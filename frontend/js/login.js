const MODE = 'DEV';

const host =  window.location.protocol + "//" + window.location.host;
const devApiHost = 'http://localhost';
const prodApiHost = 'http://134.125.44.31';
const apiHost = (MODE === 'DEV') ? devApiHost : prodApiHost;

const form = document.querySelector('#login-form');
const submitBtn = document.querySelector('.submit-btn');
const signupRef = document.querySelector('#signup-ref');

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


document.addEventListener("DOMContentLoaded", e => {
    signupRef.setAttribute("href", host + "/signup.html");
});

submitBtn.addEventListener('click', e => {
    e.preventDefault();
    let body = {
        phone: form.querySelector('#phone').value,
        password: form.querySelector('#password').value,
    };
    body = JSON.stringify(body);
    fetch(`${apiHost}/api/auth/get-token/`, {
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
        fetch(`${apiHost}/api/profile/`, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${response_data.access}`
            },
        })
        .then(handleFetchError)
        .then(response_data => {
            setTimeout(() => {
                localStorage.setItem("isCourier", response_data.isCourier);
                if (localStorage.getItem("isCourier") === "true") {
                    location.replace(host + '/courier.html');
                } else {
                    location.replace(host + '/customer.html');
                }
            }, 1000);
        })
    })
    .catch(err => {
        alert(err);
    });
});