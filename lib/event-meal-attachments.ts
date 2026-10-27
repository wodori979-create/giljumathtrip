// Shared restaurant handouts for the two Everland admission events, across all five classes.
export const everlandMealPhotos=[
 {src:'/everland-meal-menu.jpg',alt:'식사권 이용 식당·메뉴'},
 {src:'/everland-restaurant-hours.jpg',alt:'식당 운영시간'},
];
export function mealPhotosForEvent(eventId:string){
 return ['day1-everland-dinner','day2-everland-lunch'].includes(eventId)?everlandMealPhotos:[];
}
