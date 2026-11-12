export function passwordShareTargets(collections,origin) {
  const targets = new Map();
  for (const collection of collections) {
    const collectionPath = '/collections/' + encodeURIComponent(collection.slug) + '/';
    const collectionUrl = new URL(collectionPath,origin).href;
    if (collection.access?.master) targets.set(collection.access.master.id, {
      title:collection.title,label:'Вся коллекция',url:collectionUrl
    });
    for (const pass of collection.access?.passes ?? []) {
      const url = pass.items?.length === 1
        ? new URL('/reports/' + encodeURIComponent(pass.items[0]) + '/?from=' + encodeURIComponent(collection.slug),origin).href
        : collectionUrl;
      targets.set(pass.id,{title:pass.title || collection.title,label:collection.title,url});
    }
  }
  return targets;
}

export function passwordAccessMessage(target,password) {
  return `${target.title}\n${target.url}\nПароль: ${password}`;
}
