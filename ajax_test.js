let car = {id: 1, name: "bmw"};
fetch('/seecar', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify([car])
}
)
    .then(response => response.json())
    .then(json => console.log(json));
