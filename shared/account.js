// TibiaHub shared account widget: Google sign-in + character profiles + cloud progress sync.
// Include on any page that has the account-widget markup (login button, character select, etc).
// Pages with their own progress checklist should set `window.TIBIAHUB_PAGE_ID` (a short id, e.g.
// 'soulwar') BEFORE this script runs, and expose `window.TibiaHubProgress.applyRemote/revertToLocal`
// (see quests/soul-war-quest/index.html for the reference implementation). Pages without a
// checklist (like the homepage) can skip both — login and character switching still work.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

var firebaseConfig = {
  apiKey: "AIzaSyBjuGKFbdeB49W4xyxHkrnN-4iVMYpPbJ4",
  authDomain: "tibiahub-df09b.firebaseapp.com",
  projectId: "tibiahub-df09b",
  storageBucket: "tibiahub-df09b.firebasestorage.app",
  messagingSenderId: "598928814979",
  appId: "1:598928814979:web:c576f48be04c556aedfcb6",
  measurementId: "G-L7YN4Q85DW"
};

var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

// This page's id inside each character's shared `progress` map. Pages without a checklist
// (the homepage, category indexes) just leave this unset — login/characters still work.
var PAGE_ID = window.TIBIAHUB_PAGE_ID || null;

var loginBtn = document.getElementById('loginBtn');
var signedInBox = document.getElementById('accountSignedIn');
var avatarImg = document.getElementById('accountAvatar');
var charSelect = document.getElementById('charSelect');
var addCharBtn = document.getElementById('addCharBtn');
var signOutBtn = document.getElementById('signOutBtn');

var currentUser = null;
var currentCharId = null;
var charsCache = [];

loginBtn.addEventListener('click', function(){
  signInWithPopup(auth, provider).catch(function(err){
    console.error('Falha no login', err);
    alert('Não foi possível entrar com Google. Tente novamente.');
  });
});

signOutBtn.addEventListener('click', function(){ signOut(auth); });

charSelect.addEventListener('change', function(){ selectCharacter(charSelect.value); });

addCharBtn.addEventListener('click', function(){ promptNewCharacter(); });

function promptNewCharacter(isFirst){
  var msg = isFirst ? 'Bem-vindo! Como se chama seu personagem?' : 'Nome do novo personagem:';
  var name = window.prompt(msg);
  if(!name || !name.trim()) return;
  var charsRef = collection(db, 'users', currentUser.uid, 'characters');
  addDoc(charsRef, { name: name.trim(), createdAt: serverTimestamp(), progress: {} }).then(function(newDoc){
    return loadCharacters().then(function(){
      charSelect.value = newDoc.id;
      return selectCharacter(newDoc.id);
    });
  }).catch(function(err){ console.error('Falha ao criar personagem', err); });
}

function loadCharacters(){
  var charsRef = collection(db, 'users', currentUser.uid, 'characters');
  return getDocs(query(charsRef, orderBy('createdAt', 'asc'))).then(function(snap){
    charsCache = snap.docs.map(function(d){
      var data = d.data();
      return { id: d.id, name: data.name, progress: data.progress || {} };
    });
    charSelect.innerHTML = '';
    charsCache.forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      charSelect.appendChild(opt);
    });
  });
}

function selectCharacter(charId){
  currentCharId = charId;
  try{ localStorage.setItem('tibiahub-active-char', charId); }catch(e){}
  if(!PAGE_ID) return;
  var char = charsCache.find(function(c){ return c.id === charId; });
  var remoteProgress = (char && char.progress && char.progress[PAGE_ID]) || {};
  if(window.TibiaHubProgress) window.TibiaHubProgress.applyRemote(remoteProgress);
}

onAuthStateChanged(auth, function(user){
  currentUser = user;
  if(user){
    loginBtn.hidden = true;
    signedInBox.hidden = false;
    avatarImg.src = user.photoURL || '';
    setDoc(doc(db, 'users', user.uid), { email: user.email, displayName: user.displayName }, { merge: true }).catch(function(){});
    loadCharacters().then(function(){
      var savedCharId = null;
      try{ savedCharId = localStorage.getItem('tibiahub-active-char'); }catch(e){}
      if(savedCharId && charsCache.some(function(c){ return c.id === savedCharId; })){
        charSelect.value = savedCharId;
        selectCharacter(savedCharId);
      } else if(charsCache.length){
        charSelect.value = charsCache[0].id;
        selectCharacter(charsCache[0].id);
      } else {
        promptNewCharacter(true);
      }
    });
  } else {
    loginBtn.hidden = false;
    signedInBox.hidden = true;
    currentCharId = null;
    charsCache = [];
    if(PAGE_ID && window.TibiaHubProgress) window.TibiaHubProgress.revertToLocal();
  }
});

// Called by the page's own script every time a checklist checkbox changes.
window.TibiaHubCloudSync = {
  save: function(stepKey, value){
    if(!currentUser || !currentCharId || !PAGE_ID) return;
    var charRef = doc(db, 'users', currentUser.uid, 'characters', currentCharId);
    var field = 'progress.' + PAGE_ID + '.' + stepKey;
    var patch = {};
    patch[field] = value;
    updateDoc(charRef, patch).catch(function(err){ console.error('Falha ao salvar progresso', err); });
  }
};
