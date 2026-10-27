export function displayTime(value:string):string{
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
 return match?`${Number(match[1])%12||12}:${match[2]}`:value;
}
