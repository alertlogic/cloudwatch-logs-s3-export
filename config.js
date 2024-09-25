var config = {
    "api_url": {
        "us_1": {
            "url": "publicapi.alertlogic.net",
            "start": 0,
            "end": 67108863
        },
        "us_2": {
            "url": "publicapi.alertlogic.com",
            "start": 134217731,
            "end": 134283263
        },
        "uk_1": {
            "url": "publicapi.alertlogic.co.uk",
            "start": 67108867,
            "end": 134217727
        }
    },
    "ci_api_url": `${process.env.al_api}`
};

module.exports = config;
