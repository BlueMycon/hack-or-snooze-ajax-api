"use strict";

const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/******************************************************************************
 * Story: a single story in the system
 */

class Story {

  /** Make instance of Story from data object about story:
   *   - {title, author, url, username, storyId, createdAt}
   */

  constructor({ storyId, title, author, url, username, createdAt }) {
    this.storyId = storyId;
    this.title = title;
    this.author = author;
    this.url = url;
    this.username = username;
    this.createdAt = createdAt;
  }

  /** Parses hostname out of URL and returns it. */

  getHostName() {
    // use RegEx, or....loop through string until third '/' or end of string
    // TODO: look into MDN doc for URL objects in JS
    const jsURL = new URL(this.url);
    return jsURL.hostname || "hostname";

    const reMatch = this.url.match(/(https?:\/\/(www\.)?[^\/]+)/);
    if (reMatch) return reMatch[0];
    return "hostname";
  }
}


/******************************************************************************
 * List of Story instances: used by UI to show story lists in DOM.
 *
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /** Generate a new StoryList. It:
   *
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.
   */

  static async getStories() {
    // Note presence of `static` keyword: this indicates that getStories is
    //  **not** an instance method. Rather, it is a method that is called on the
    //  class directly. Why doesn't it make sense for getStories to be an
    //  instance method?

    // query the /stories endpoint (no auth required)
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "GET",
    });

    // turn plain old story objects from API into instances of Story class
    const stories = response.data.stories.map(story => new Story(story));

    // build an instance of our own class using the new array of stories
    return new StoryList(stories);
  }

  /** Adds story data to API, makes a Story instance, adds it to story list.
   * - user - the current instance of User who will post the story
   * - obj of {title, author, url}
   *
   * Returns the new Story instance
   */

  async addStory(user, newStory) {
    // UNIMPLEMENTED: complete this function!
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "POST",
      data: { token: user.loginToken, story: newStory },
    });

    const story = new Story(response.data.story);

    this.stories.unshift(story);

    // FIXME: the user itself should be doing this as a method
    // perhaps a controller should speak to both StoryList and User to tell them these commands
    user.ownStories.unshift(story);

    return story;
  }

  async removeStory(user, story) {
    const response = await axios({
      url: `${BASE_URL}/stories/${story.storyId}`,
      method: "DELETE",
      data: { token: user.loginToken },
    });

    const storyId = response.data.story.storyId;

    console.log("this.stories before=", this.stories);
    const indexToRemove = this.stories.findIndex(s => s.storyId === storyId);
    this.stories.slice(indexToRemove, 1);
    console.log("this.stories after=", this.stories);

    // FIXME: the user itself should be doing this as a method
    // perhaps a controller should speak to both StoryList and User to tell them these commands
    console.log("user.ownStories before=", user.ownStories);
    const ownStoriesIndexToRemove = user.ownStories.findIndex(s => s.storyId === storyId);
    user.ownStories.slice(ownStoriesIndexToRemove, 1);
    console.log("user.ownStories after=", user.ownStories);

    return response.data.message;
  }
}


/******************************************************************************
 * User: a user in the system (only used to represent the current user)
 */
// FIXME: should user have their own token?
class User {
  /** Make user instance from obj of user data and a token:
   *   - {username, name, createdAt, favorites[], ownStories[]}
   *   - token
   */

  constructor({
                username,
                name,
                createdAt,
                favorites = [], // FIXME: class StoryList, if API allows
                ownStories = [] // FIXME: class StoryList, if API allows
              },
              token) {
    this.username = username;
    this.name = name;
    this.createdAt = createdAt;

    // instantiate Story instances for the user's favorites and ownStories
    this.favorites = favorites.map(s => new Story(s));
    this.ownStories = ownStories.map(s => new Story(s));

    // store the login token on the user so it's easy to find for API calls.
    this.loginToken = token;
  }

  /** Register new user in API, make User instance & return it.
   *
   * - username: a new username
   * - password: a new password
   * - name: the user's full name
   */

  static async signup(username, password, name) {
    const response = await axios({
      url: `${BASE_URL}/signup`,
      method: "POST",
      data: { user: { username, password, name } },
    });

    const { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** Login in user with API, make User instance & return it.

   * - username: an existing user's username
   * - password: an existing user's password
   */

  static async login(username, password) {
    const response = await axios({
      url: `${BASE_URL}/login`,
      method: "POST",
      data: { user: { username, password } },
    });

    const { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** When we already have credentials (token & username) for a user,
   *   we can log them in automatically. This function does that.
   */

  static async loginViaStoredCredentials(token, username) {
    try {
      const response = await axios({
        url: `${BASE_URL}/users/${username}`,
        method: "GET",
        params: { token },
      });

      const { user } = response.data;

      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories
        },
        token
      );
    } catch (err) {
      console.error("loginViaStoredCredentials failed", err);
      return null;
    }
  }

  /** Let user favorite a story
   * - story: an instance of Story
  */
  async addFavorite(story) {
    const response = await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${story.storyId}`,
      method: "POST",
      data: { token: this.loginToken },
    });

    this.favorites.unshift(new Story(story));

    // FIXME: what do I want to return here?
    return response.data.message;
  }

  /** Let user unfavorite a story
   * - story: an instance of Story
  */

  async removeFavorite(story) {
    const response = await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${story.storyId}`,
      method: "DELETE",
      data: { token: this.loginToken },
    });

    this.favorites = this.favorites.filter(s => s.storyId !== story.storyId);

    // FIXME: what do I want to return here?
    return response.data.message;
  }
}

// FIXME: does the client or user perform login, logout, signup, etc...?
/** Client: an API client, used to control the flow of data
 * - Each API endpoint has a corresponding instance method such as:
      async clientMethod(...params) {
        const response = await axios({
          url: `${BASE_URL}/${path goes here}`,
          method: "API endpoint verb goes here",
          params: { as per the API docs },
        });

        return response.data;
      }
 *
 */

class Client {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  // LoginEndpoint for logging in to get a token and see your profile.
  // Login to Receive a Token
  async login(username, password) {
    const response = await axios({
      url: `${BASE_URL}/login`,
      method: "POST",
      data: { user: { username, password } },
    });

    const { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** When we already have credentials (token & username) for a user,
   *   we can log them in automatically. This function does that.
   */
  async loginViaStoredCredentials(username) {
    try {
      const response = await axios({
        url: `${BASE_URL}/users/${username}`,
        method: "GET",
        params: { token: this.token },
      });

      const { user } = response.data;

      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories
        },
        this.token
      );
    } catch (err) {
      console.error("loginViaStoredCredentials failed", err);
      return null;
    }
  }



  // SignupEndpoint for creating an account and getting a token from the server.
  // Signup and Get a Token
  // TODO: pick one of the following three:
  // - new User argument passed to client <--- my pref
  // - controller constructs new User after client signup <--- controller try/catch client command
  // - client returns new User
  async signup(username, password, name) {
    const response = await axios({
      url: `${BASE_URL}/signup`,
      method: "POST",
      data: { user: { username, password, name } },
    });

    const { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }


  // Users
  // Endpoint to create a user or query for a list of users.
  // Get a List of Users
  // Token Required.
  // Note: passwords are not visible at this endpoint. By default, limit is set to 25.
  async getUsers() {
    const response = await axios({
      url: `${this.baseURL}/users`,
      method: "GET",
      params: { token: this.token },
    });
    return response.data;
  }

  // UserEndpoint for reading, updating, or deleting a single user.
  // Get a User
  // Token Required. Retrieve a single user document by username.
  // FIXME: if the user needs the token, what is this for?
  async getUser(user) {
    // TODO: determine where skip and limit values come from
    // const p = `?skip=${skip}&limit=${limit}` || ''
    const response = await axios({
      url: `${this.baseURL}/users/${user.username}`,
      method: "GET",
      params: { token: this.token },
    });

    return response.data;
  }

  // Update a User
  // Token Required. Correct User Required.
  // Update a single user document by username.
  // Note: username and favorites are immutable via this endpoint.
  /**
   * body looks like:
    {
      "token": "YOUR TOKEN GOES HERE",
      "user": {
          "name": "A Changed Name"
      }
    }
   *
   *
   */
  // FIXME: updateUser or patchUser for _client_ method name
  async updateUser(user) {
    const response = await axios({
      url: `${this.baseURL}/users/${user.username}`,
      method: "PATCH",
      // FIXME: can I just pass in user?
      data: { token: this.token, user: { name: user.name } }
    });

    return response.data;
    // TODO: controller must update user and body

  }

  // Delete a User
  // Token Required. Correct User Required. Remove a single user document by username.User Favorites
  async deleteUser(user) {
    const response = await axios({
      url: `${this.baseURL}/users/${user.username}`,
      method: "DELETE",
      data: { token: this.token },
    });

    return response.data;
  }
  // Add a New Favorite
  // Token Required. Correct User Required. Full user document will be returned. Note: password will not be present in the response. There is no request body necessary.
  // FIXME: addFavorite or postFavorite for client method name?
  async addFavorite(user, story) {
    const response = await axios({
      url: `${this.baseURL}/users/${user.username}/favorites/${story.storyId}`,
      method: "POST",
      data: { token: this.token },
    });

    return response.data;
    // TODO: controller must update user and body
  }

  // Delete a User Favorite
  // Token Required.
  // Correct User Required.
  // Full user document will be returned.
  // Note: password will not be present in the response.
  // There is no request body necessary.
  // FIXME: deleteFavorite or removeFavorite as client method name?
  async deleteFavorite(user, story) {
    const response = await axios({
      url: `${this.baseURL}/users/${user.username}/favorites/${story.storyId}`,
      method: "DELETE",
      data: { token: this.token }
    });

    return response.data;
    // TODO: controller must update user and body

  }

  // StoriesEndpoint to create a story or query for a list of stories.
  // Get a List of Stories
  // By default, limit is set to 25.
  // NOTE: this method does not need to be static for the client object
  async getStories() {
    // TODO: determine where skip and limit values come from
    // const p = `?skip=${skip}&limit=${limit}` || ''
    const response = await axios({
      url: `${this.baseURL}/stories`,
      method: "GET",
    });

    // FIXME: controller should next construct a StoryList
    // turn plain old story objects from API into instances of Story class
    // const stories = response.data.stories.map(story => new Story(story));
    // build an instance of our own class using the new array of stories
    // return new StoryList(stories);

    return response.data;
  }

  // Create a New Story
  // Token Required. The fields username, title, author, and url are required.StoryEndpoint for reading, updating, or deleting a single story.
  async addStory(user, newStory) {
    const response = await axios({
      url: `${this.baseURL}/stories`,
      method: "POST",
      data: { token: this.token , story: newStory },
    });

    // TODO: controller next orders up this logic
    // const story = new Story(response.data.story);
    // this.stories.unshift(story);

    // TODO: controller next orders up this logic
    // FIXME: the user itself should be doing this as a method
    // perhaps a controller should speak to both StoryList and User to tell them these commands
    // user.ownStories.unshift(story);
    // return story;

    return response.data;
  }

  // Get a Story
  // Retrieve a single story document by storyId.
  async getStory(story) {
    const response = await axios({
      url: `${this.baseURL}/stories/${story.storyId}`,
      method: "GET"
    });

    return response.data;
  }


  // Update a Story
  // Token Required. Correct User Required.
  // Update a single story document by storyId.
  // Note: username is immutable at this endpoint.
  async updateStory(story) {
    const response = await axios({
      url: `${this.baseURL}/stories/${story.storyId}`,
      method: "PATCH",
      data: { token: this.token, story: { author: story.author }}
    });
  }


  // Delete a Story
  // Token Required. Correct User Required. Remove a single story document by storyId.
  async removeStory(user, story) {
    const response = await axios({
      url: `${this.baseURL}/stories/${story.storyId}`,
      method: "DELETE",
      data: { token: this.token },
    });

    // TODO: controller next orders this logic
    // const storyId = response.data.story.storyId;
    // const indexToRemove = this.stories.findIndex(s => s.storyId === storyId);
    // this.stories.slice(indexToRemove, 1);

    // TODO: controller next orders this logic
    // FIXME: the user itself should be doing this as a method
    // perhaps a controller should speak to both StoryList and User to tell them these commands
    // const ownStoriesIndexToRemove = user.ownStories.findIndex(s => s.storyId === storyId);
    // user.ownStories.slice(ownStoriesIndexToRemove, 1);

    return response.data.message;
  }
}
