"use strict";

// This is the global list of the stories,
// an instance of StoryList
let storyList;

/** Get and show stories when site first loads.*
 */

async function getAndShowStoriesOnStart() {
  storyList = await StoryList.getStories();
  $storiesLoadingMsg.remove();

  putStoriesOnPage();
}

/**
 * A render method to render HTML for an individual Story instance
 * - story: an instance of Story
 *
 * Returns the markup for the story.
 */

function generateStoryMarkup(story) {
  // console.debug("generateStoryMarkup", story);
  // want to only show <i> if logged in
  const storyIsFavorited = currentUser?.favorites.find(s => s.storyId === story.storyId)
  const starStyle = storyIsFavorited ? "-fill" : "";

  // trash icon, conditional on closest <ol> being #my-stories-list
  // TODO: what I would prefer is to pass the event.target
  // because the event target is the nav-link that determines these boolean switches
  const isViewingMyStories = $navLinkLastClicked ? $navLinkLastClicked.attr("id") === "nav-my-stories": false;

  const hostName = story.getHostName();

  return $(`
      <li id="${story.storyId}">
        ${isViewingMyStories ? `<small><i class="bi bi-trash trash"></i></small>` : ""}
        ${currentUser ? `<small><i class="bi bi-star${starStyle} star"></i></small>` : ""}
        <a href="${story.url}" target="a_blank" class="story-link">
          ${story.title}
        </a>
        <small class="story-hostname">(${hostName})</small>
        <small class="story-author">by ${story.author}</small>
        <small class="story-user">posted by ${story.username}</small>
      </li>
    `);
}

/** Gets list of stories from server,
 * generates their HTML,
 * and puts on page.
 */

function putStoriesOnPage() {
  console.debug("putStoriesOnPage");

  $allStoriesList.empty();

  // loop through all of our stories and generate HTML for them
  for (let story of storyList.stories) {
    const $story = generateStoryMarkup(story);
    $allStoriesList.append($story);
  }

  $allStoriesList.show();
}

function putFavoritesOnPage() {
  console.debug("putFavoritesOnPage");

  $userFavoritesList.empty();

  // loop through all user storeis and generate HTML for them
  for (let story of currentUser.favorites) {
    const $favStory = generateStoryMarkup(story);
    $userFavoritesList.append($favStory);
  }

  $userFavoritesList.show();
}

function putMyStoriesOnPage() {
  console.debug("putMyStoriesOnPage");

  $myStoriesList.empty();

  // loop through all user own stories and generate HTML for them
  for (let story of currentUser.ownStories) {
    const $myOwnStory = generateStoryMarkup(story);
    $myStoriesList.append($myOwnStory);
  }

  $myStoriesList.show();
}

// Write a function that is called when users submit the form.
// Pick a good name for it.
// This function should get the data from form,
// call the .addStory method you wrote,
// and then put that new story on the page.
async function submitNewStory(evt) {
  evt.preventDefault();

  const newStory = {
    title: $("#story-title").val(),
    author: $("#story-author").val(),
    url: $("#story-url").val(),
  };

  // add the story to the API
  const story = await storyList.addStory(currentUser, newStory);

  // put the new story on the page
  const $story = generateStoryMarkup(story);
  $allStoriesList.prepend($story);

  // hide the form, show the story list
  $submitStoryForm.hide();
  $submitStoryForm.trigger("reset");
  $allStoriesList.show();
}

$submitStoryForm.on("submit", submitNewStory);

async function getStory(storyId) {
  const response =  await axios({
    url: `${BASE_URL}/stories/${storyId}`,
    method: "GET",
  });

  return response.data.story;
}


async function toggleStoryFavorite(evt) {
  evt.preventDefault();

  // need Story instance that was clicked
    // get target of click, an icon elemet
    // traverse DOM to grab storyId of containing <li>
    // use storyId to get story from global storyList
  const $evtTargetStar =  $(evt.target);
  const storyId = $evtTargetStar.closest("li").attr("id");
  const story = await getStory(storyId);

  if ($evtTargetStar.hasClass("bi-star")) {
    // unfilled, addFav, change style
    await currentUser.addFavorite(story);
    $evtTargetStar.toggleClass("bi-star bi-star-fill");
  } else {
    // removeFav, change style
    await currentUser.removeFavorite(story);
    $evtTargetStar.toggleClass("bi-star bi-star-fill");

    // refresh favorties list
    if ($evtTargetStar.closest("ol").hasClass("user-favorites-list")) {
      putFavoritesOnPage();
    }
  }
}

// FIXME: gratuitious; try delegating via <body>?
$allStoriesList.on("click", ".star", toggleStoryFavorite);
$userFavoritesList.on("click", ".star", toggleStoryFavorite);
$myStoriesList.on("click",".star", toggleStoryFavorite);

// FIXME: trash does not dynamically remove story from  $allStoriesList or $userFavoritesList
// this should not require a refresh; no ghosts
async function removeMyStory(evt) {
  evt.preventDefault();

  const $evtTargetTrashIcon = $(evt.target);
  const storyId = $evtTargetTrashIcon.closest("li").attr("id");
  const story = await getStory(storyId);

  // remove this from stories on backend
  // remove from active memory
  // remove form user's own stories
  // get confirmation of removals
  const message = await storyList.removeStory(currentUser, story);
  console.log("message=", message);
  // remove from HTML surgically, do not repaint entire story list
  $evtTargetTrashIcon.closest("li").remove();
}

// listener for trash, only on myStories
$myStoriesList.on("click",".trash", removeMyStory);
