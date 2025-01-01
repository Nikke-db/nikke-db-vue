/* eslint-disable */
enum globalParams {
  GITHUB = 'https://github.com/Nikke-db/nikke-db-vue',
  LOCALHOST = 'http://localhost:5500/',
  // NIKKE_DB = 'https://nikke-db-legacy.pages.dev/',
  NIKKE_DB = LOCALHOST,
  PATH_L2D = NIKKE_DB + 'l2d/',
  PATH_L2D_AIM = 'aim/',
  PATH_L2D_COVER = 'cover/',
  PATH_SPRITE_1 = 'images/sprite/si_',
  PATH_SPRITE_2 = '_00_s.png',
  BUILD_PATH = 'chibi/Build/',
  STREAMING_ASSETS_PATH = 'chibi/StreamingAssets',
  GALLERY_PATH = 'images/gallery/',
  CHIBI_BUILD = NIKKE_DB + BUILD_PATH,
  STREAMING_ASSETS = NIKKE_DB + STREAMING_ASSETS_PATH,
  GALLERY = NIKKE_DB + GALLERY_PATH,
  LOCALHOST_CHIBI_BUILD = LOCALHOST + BUILD_PATH,
  LOCALHOST_STREAMING_ASSETS = LOCALHOST + STREAMING_ASSETS_PATH,
  CRYPTOJS_AES_KEY = 'Nikke DB AES Key' //never change this or it'll break tierlist save slots
}

enum messagesEnum {
  MESSAGE_ERROR = 'Something went wrong, if it is unexpected contact me on discord or GitHub',
  MESSAGE_ASSET_LOADED = 'Assets loaded',
  MESSAGE_LOCALSTORAGE_SAVED = 'Data saved to the local storage',
  MESSAGE_CANCELLED = 'Action Cancelled',
  MESSAGE_CANNOT_SAVE_EMPTY = 'Cannot save an empty value',
  MESSAGE_WRONG_FORM_DATA = 'Something is wrong with the form data you\'ve entered',
  MESSAGE_PROCESSING = 'Processing',
  MESSAGE_UNLOAD = "Unloaded older asset successfully",
  MESSAGE_WRONG_FILE_FORMAT = "Wrong file format",
  MESSAGE_UI_SHOWBACK = "Press the \"Enter\" key to show the UI back",
  MESSAGE_TIERLIST_DELETE_ROW = "Row deleted, characters that were in that row have been transferred to the bench",
  MESSAGE_TIERLIST_UPDATED_ROW = "Row updated",
  MESSAGE_TIERLIST_SCREENSHOT_CONVERT2CANVAS = "Converting HTML data to a canvas object...",
  MESSAGE_TIERLIST_SCREENSHOT_CANVAS2PNG = "Downloading a canvas to a PNG file",
  MESSAGE_EXPORT_ANIMATION = "Replaying and exporting animation...",
  MESSAGE_EXPORT_ANIMATION_SUCCESS = "Animation exported successfully",
  MESSAGE_EXPORT_ANIMATION_FAILED = "Animation export failed",
}

enum theme {
  BACKGROUND_COLOR = '#2f353a',
  BACKGROUND_COLOR_2 = '#212529',
  NAIVE_GREEN = '#63e2b7',
  GREY = 'rgb(180, 175, 175)'
}

export { globalParams, messagesEnum, theme }
