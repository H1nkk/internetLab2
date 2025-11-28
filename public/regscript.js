console.log('loaded');
document.addEventListener('DOMContentLoaded', function() {
    const regButton = document.getElementById("regbutton");

    regButton.addEventListener('click', function() {
        console.log("asdasd");
        window.location.href = '/register';
    })
})
