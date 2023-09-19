enum globalParams {
    GITHUB = "https://github.com/Nikke-db/nikke-db-vue",
    NIKKE_DB = "https://nikke-db.pages.dev/",
    PATH_L2D = "l2d/",
    PATH_L2D_AIM = "aim/",
    PATH_L2D_COVER = "cover",
    PATH_SPRITE_1 = 'images/sprite/si_',
    PATH_SPRITE_2 = "_00_s.png"
}

enum messagesEnum {
    MESSAGE_ERROR = "Something went wrong, if it is unexpected contact me on discord or GitHub",
    MESSAGE_ASSET_LOADED = "Assets loaded",
    MESSAGE_LOCALSTORAGE_SAVED = "Data saved to the local storage",
    MESSAGE_CANCELLED = "Action Cancelled",
    MESSAGE_CANNOT_SAVE_EMPTY = "Cannot save an empty value",
    MESSAGE_WRONG_FORM_DATA = "Something is wrong with the form data you've entered",
    MESSAGE_PROCESSING = "Processing"
}

enum theme {
    BACKGROUND_COLOR = '#2f353a',
    BACKGROUND_COLOR_2 = '#212529',
    NAIVE_GREEN = '#63e2b7',
    GREY = 'rgb(180, 175, 175)'
}

export {globalParams, messagesEnum, theme}