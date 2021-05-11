const onLoginButtonClicked = async () => {
    const apiKey = document.getElementById('api-key').value;
    const secret = document.getElementById('secret').value;
    const uid = document.getElementById('user-id').value;

    const statusDiv = document.getElementById('loginStatusDiv');

    const label = document.createElement('label');

    try {
        await axios.post('/login', {apiKey, secret, uid});

        label.appendChild(document.createTextNode('Success'));
    } catch (e) {
        label.appendChild(document.createTextNode(`Login failed with the following error message ${e.response.data}`));
    }

    statusDiv.appendChild(label);
};

const cancelAllOrders = async() => {
    const uid = document.getElementById('user-id').value;

    const statusDiv = document.getElementById('cancelOrdersStatusDiv');

    const label = document.createElement('label');

    try {
        await axios.post(`/cancelAllOrders/${uid}`, {});

        label.appendChild(document.createTextNode('Success'));
    } catch (e) {
        label.appendChild(document.createTextNode(`Login failed with the following error message ${e.response.data}`));
    }

    statusDiv.appendChild(label);
};

const createOrder = async() => {
    const uid = document.getElementById('user-id').value;

    const statusDiv = document.getElementById('createOrderStatusDiv');

    const label = document.createElement('label');

    try {
        await axios.post(`/order/${uid}`, {});

        label.appendChild(document.createTextNode('Success'));
    } catch (e) {
        label.appendChild(document.createTextNode(`Login failed with the following error message ${e.response.data}`));
    }

    statusDiv.appendChild(label);
};
