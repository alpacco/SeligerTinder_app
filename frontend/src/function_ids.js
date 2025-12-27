// Список ID для функций из main.js (на основе old_code)
// Используются для удобства и однозначной идентификации функций

const FUNCTION_IDS = {
  // Основной поток
  INIT_FLOW: "initFlow",
  CHECK_IF_REGISTERED: "checkIfRegistered",
  LOAD_USER_DATA: "loadUserData",
  SHOW_SCREEN: "showScreen",

  // Экраны и UI
  UPDATE_WELCOME_SCREEN: "updateWelcomeScreen",
  UPDATE_GENDER_SCREEN: "updateGenderScreen",
  UPDATE_SWIPE_SCREEN: "updateSwipeScreen",
  UPDATE_PROFILE_SCREEN: "updateProfileScreen",
  INIT_PROFILE_EDIT_SCREEN: "initProfileEditScreen",
  EXIT_PROFILE_EDIT_MODE: "exitProfileEditMode",
  SAVE_PROFILE_CHANGES: "saveProfileChanges",

  // Карточки и свайпы
  FILL_CARD: "fillCard",
  SETUP_SWIPE_CONTROLS: "setupSwipeControls",
  MOVE_TO_NEXT_CANDIDATE: "moveToNextCandidate",
  SHOW_PREVIOUS_CANDIDATE: "showPreviousCandidate",
  HIDE_BADGES: "hideBadges",

  // Взаимодействия
  ON_MUTUAL_LIKE: "onMutualLike",
  ON_SUPER_MATCH: "onSuperMatch",
  SELECT_GENDER: "selectGender",
  SHARE_INVITE: "shareInvite",

  // Фотографии
  HANDLE_PHOTO_ADDITION: "handlePhotoAddition",
  HANDLE_PHOTO_DELETION: "handlePhotoDeletion",
  RENDER_PAGINATOR: "renderPaginator",

  // Мэтчи
  UPDATE_MATCHES_COUNT: "updateMatchesCount",
  RENDER_MATCHES: "renderMatches",
  SHOW_CANDIDATE_PROFILE: "showCandidateProfile",

  // Модальные окна
  SHOW_TELEGRAM_MODAL: "showTelegramModal",
  HIDE_TELEGRAM_MODAL: "hideTelegramModal",
  SHOW_TOAST: "showToast",

  // Вспомогательные
};

export default FUNCTION_IDS;
