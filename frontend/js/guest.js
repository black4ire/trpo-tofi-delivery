const host =  window.location.protocol + "//" + window.location.host;
const loginBtn = document.querySelector('#login-btn');
const myWorkspaceBtn = document.querySelector('#my-workspace');

document.addEventListener("DOMContentLoaded", (e)=> {
    if (localStorage.getItem("isCourier") !== null && localStorage.getItem("access") !== null) {
        // значит кто-то уже вошёл
        loginBtn.querySelector('a').innerHTML = 'Выйти';
        loginBtn.setAttribute('href', '#');
        loginBtn.addEventListener('click', (e) => {
            localStorage.removeItem('isCourier');
            localStorage.removeItem('access');
            location.replace(host + '/index.html');
        });
        // выбираем куда можно попасть, в личный кабинет курьера или заказчика
        if (localStorage.getItem("isCourier") === "false") {
            myWorkspaceBtn.querySelector('a').setAttribute('href', '/customer.html');
        }
        else {
            myWorkspaceBtn.querySelector('a').setAttribute('href', '/courier.html');
        }
    }
    else {
        myWorkspaceBtn.remove();
    }
});