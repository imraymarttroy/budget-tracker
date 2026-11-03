/* English / Filipino. The app is written in English; when Filipino is chosen, UI text is
   swapped as it reaches the page. User content (posts, messages, bios, entry names) is never touched. */
(function () {
  'use strict';

  const STORAGE_KEY = 'pbh-language';
  const LANGS = { 'English (US)': 'en', 'Filipino': 'fil' };

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (error) { return null; }
  }
  const name = LANGS[stored()] ? stored() : 'English (US)';
  const code = LANGS[name];

  /* Exact UI strings (matched after trimming; surrounding spaces are kept). */
  const FIL = {
    // Password toggle
    'Show password': 'Ipakita ang password',
    'Hide password': 'Itago ang password',
    'Something went wrong. Please try again.': 'May nagkaproblema. Pakisubukan ulit.',

    // Page titles and navigation
    'Sign in': 'Mag-sign in',
    'Sign up': 'Mag-sign up',
    'Reset password': 'I-reset ang password',
    'Verify your email': 'I-verify ang email mo',
    'Set up your profile': 'I-set up ang profile mo',
    'Dashboard': 'Dashboard',
    'Profile': 'Profile',
    'Circle': 'Circle',
    'Messages': 'Mga Mensahe',
    'Notifications': 'Mga Notipikasyon',
    'Settings': 'Mga Setting',
    'Could not load': 'Hindi ma-load',
    'Finish signing up': 'Tapusin ang pag-sign up',
    'Main': 'Pangunahin',

    // Sign in / sign up
    'Welcome back': 'Maligayang pagbabalik',
    'Join PassbookHub': 'Sumali sa PassbookHub',
    'Don’t have an account?': 'Wala ka pang account?',
    'Already have an account?': 'May account ka na?',
    'Log in': 'Mag-log in',
    'Or': 'O',
    'Half for needs, some for wants, the rest for later.': 'Kalahati para sa pangangailangan, kaunti para sa gusto, ang natitira para sa hinaharap.',
    'Language': 'Wika',
    'Close': 'Isara',
    'Select your language': 'Piliin ang wika mo',
    'Needs: rent, bills and groceries': 'Pangangailangan: upa, bills at grocery',
    'Wants: the fun stuff, guilt-free': 'Gusto: mga nakakatuwang bagay, walang guilt',
    'Savings: future you says thanks': 'Ipon: magpapasalamat ang future mo',
    'Create your account': 'Gumawa ng account',
    'Good to see you again \u{1F44B}': 'Masaya kaming makita ka ulit \u{1F44B}',
    'Budget the simple way ✨': 'Mag-budget sa simpleng paraan ✨',
    'Pick up where you left off': 'Ituloy kung saan ka huminto',
    'Start your budget': 'Simulan ang budget mo',
    'Your daily feed for financial freedom.': 'Ang araw-araw mong gabay tungo sa financial freedom.',
    'Follow these simple steps to set up your account.': 'Sundin ang mga simpleng hakbang na ito para i-set up ang account mo.',
    'Enter your email address.': 'Ilagay ang email address mo.',
    'Enter your password.': 'Ilagay ang password mo.',
    'Signing in…': 'Nagsa-sign in…',
    'Incorrect email or password.': 'Mali ang email o password.',
    'Email or username': 'Email o username',
    'you@example.com or juandc': 'you@example.com o juandc',
    'Enter your email or username.': 'Ilagay ang email o username mo.',
    'No account uses that email.': 'Mali ang email. Walang account na gumagamit nito.',
    'No account has that username.': 'Mali ang username. Walang account na may ganito.',
    'Incorrect password.': 'Mali ang password.',
    'Sign in with your email this time. After that, your username works too.': 'Mag-sign in muna gamit ang email mo ngayon. Pagkatapos nito, gagana na rin ang username mo.',
    'Email': 'Email',
    'Password': 'Password',
    'Your password': 'Ang password mo',
    'Forgot password?': 'Nakalimutan ang password?',
    'Continue': 'Magpatuloy',
    'Creating account…': 'Ginagawa ang account…',
    'We use this to verify your account.': 'Gagamitin namin ito para i-verify ang account mo.',
    'Full name': 'Buong pangalan',
    'Username': 'Username',
    'Birthday': 'Kaarawan',
    'At least 8 characters.': 'Hindi bababa sa 8 character.',
    'Create a password': 'Gumawa ng password',
    'We could not send the email. Please try again.': 'Hindi namin naipadala ang email. Pakisubukan ulit.',
    'Checking…': 'Sinusuri…',
    'Your email is not verified yet. Open the link in the email we sent, then try again.': 'Hindi pa verified ang email mo. Buksan ang link sa email na ipinadala namin, tapos subukan ulit.',
    'Email verified.': 'Na-verify na ang email.',
    'I have verified my email': 'Na-verify ko na ang email ko',
    'Send the link again': 'Ipadala ulit ang link',
    'Verification email sent.': 'Naipadala na ang verification email.',
    'Use a different account': 'Gumamit ng ibang account',
    'Passwords are stored encrypted, so we cannot show you your old one. We can email you a link to set a new one.': 'Naka-encrypt ang mga password, kaya hindi namin maipapakita ang luma mong password. Puwede ka naming padalhan ng link sa email para gumawa ng bago.',
    'Enter a valid email address.': 'Maglagay ng tamang email address.',
    'Sending…': 'Ipinapadala…',
    'Send reset link': 'Ipadala ang reset link',
    'Reset email sent.': 'Naipadala na ang reset email.',
    'Use a different email': 'Gumamit ng ibang email',
    'Reset your password': 'I-reset ang password mo',
    'Back to sign in': 'Bumalik sa sign in',
    'We could not load your account': 'Hindi namin ma-load ang account mo',
    'Check your internet connection, then try again.': 'Tingnan ang internet connection mo, tapos subukan ulit.',
    'Try again': 'Subukan ulit',
    'Sign out': 'Mag-sign out',
    'Your sign-up did not finish': 'Hindi natapos ang pag-sign up mo',
    'Your account was created but your profile was not saved. Start over to sign up again with the same email.': 'Nagawa ang account mo pero hindi na-save ang profile mo. Magsimula ulit para mag-sign up gamit ang parehong email.',
    'Start over': 'Magsimula ulit',
    'Name': 'Pangalan',
    'This becomes your profile name.': 'Ito ang magiging pangalan sa profile mo.',
    'Create account': 'Gumawa ng account',
    'Almost done': 'Malapit na',
    'Pick a username and add your birthday to finish creating your PassbookHub account.': 'Pumili ng username at ilagay ang kaarawan mo para matapos ang paggawa ng PassbookHub account mo.',
    'Cancel and go back': 'I-cancel at bumalik',

    // Profile setup and settings
    'Choose an image file.': 'Pumili ng image file.',
    'Choose an image under 20 MB.': 'Pumili ng larawang mas mababa sa 20 MB.',
    'We could not read that image. Try a JPG or PNG.': 'Hindi namin mabasa ang larawang iyan. Subukan ang JPG o PNG.',
    'Remove': 'Alisin',
    'Bio': 'Bio',
    'A line or two about you and your money goals.': 'Isa o dalawang linya tungkol sa iyo at sa mga money goal mo.',
    'Profile picture': 'Profile picture',
    'Choose photo': 'Pumili ng larawan',
    'Saving…': 'Sine-save…',
    'Skip for now': 'Laktawan muna',
    'Add a picture and a short bio. You can change these at any time.': 'Maglagay ng larawan at maikling bio. Puwede mo itong palitan anumang oras.',
    'Currency': 'Currency',
    'Enter your name.': 'Ilagay ang pangalan mo.',
    'Profile saved.': 'Na-save ang profile.',
    'Changes the symbol only. Amounts are not converted.': 'Simbolo lang ang papalitan. Hindi iko-convert ang mga halaga.',
    'Save changes': 'I-save ang mga pagbabago',
    'Cancel': 'I-cancel',
    'Delete account': 'Burahin ang account',
    'Keep account': 'Panatilihin ang account',
    'Deleting…': 'Binubura…',
    'Your account has been deleted.': 'Nabura na ang account mo.',
    'This permanently deletes your profile and every transaction. Enter your password to confirm.': 'Permanenteng mabubura nito ang profile mo at lahat ng transaksyon. Ilagay ang password mo para kumpirmahin.',
    'Yes, delete everything': 'Oo, burahin lahat',
    'Account': 'Account',
    'Sign-in': 'Pag-sign in',
    'You have signed out.': 'Naka-sign out ka na.',

    // Posts
    'Just now': 'Ngayon lang',
    'Who can see this': 'Sino ang makakakita nito',
    'Change who can see this post': 'Palitan kung sino ang makakakita ng post na ito',
    'Delete post': 'Burahin ang post',
    'Post deleted.': 'Nabura ang post.',
    'Yes': 'Oo',
    'No': 'Hindi',
    'We could not read that file.': 'Hindi namin mabasa ang file na iyan.',
    'We could not open that image.': 'Hindi namin mabuksan ang larawang iyan.',
    'We could not prepare that photo.': 'Hindi namin maihanda ang larawang iyan.',
    'Click again to delete': 'I-click ulit para burahin',
    'Loading posts…': 'Nilo-load ang mga post…',
    'You have not posted yet.': 'Wala ka pang post.',
    'No posts to show.': 'Walang post na maipapakita.',
    'We could not load posts.': 'Hindi namin ma-load ang mga post.',
    'Posting…': 'Pino-post…',
    'Posted.': 'Na-post na.',
    'Write a post': 'Sumulat ng post',
    'Post': 'I-post',
    'Edit profile': 'I-edit ang profile',
    'Posts': 'Mga Post',
    'Public': 'Public',
    'Anyone on PassbookHub': 'Kahit sino sa PassbookHub',
    'Only people in your circle': 'Mga nasa circle mo lang',
    'Only me': 'Ako lang',
    'Only you': 'Ikaw lang',
    'Write something first.': 'Sumulat muna ng kahit ano.',
    'Choose who can see this.': 'Piliin kung sino ang makakakita nito.',

    // Circle
    'In your circle ✓': 'Nasa circle mo ✓',
    'Remove from circle?': 'Alisin sa circle?',
    'Request sent · Cancel': 'Naipadala ang request · I-cancel',
    'Request cancelled.': 'Na-cancel ang request.',
    'Accept': 'Tanggapin',
    'Decline': 'Tanggihan',
    'Request declined.': 'Tinanggihan ang request.',
    'Wants to add you': 'Gusto kang idagdag',
    '+ Add to circle': '+ Idagdag sa circle',
    'Loading profile…': 'Nilo-load ang profile…',
    'Profile not found': 'Hindi nahanap ang profile',
    'Search for people': 'Maghanap ng tao',
    'We could not load this profile.': 'Hindi namin ma-load ang profile na ito.',
    'Message': 'Mag-message',
    'Search by name or @username': 'Maghanap gamit ang pangalan o @username',
    'Loading your circle…': 'Nilo-load ang circle mo…',
    'View profile': 'Tingnan ang profile',
    'Add to circle': 'Idagdag sa circle',
    'Request sent · Tap to cancel': 'Naipadala ang request · Pindutin para i-cancel',
    'Searching…': 'Naghahanap…',
    'Your circle is empty. Search for people above to add them.': 'Wala pang laman ang circle mo. Maghanap ng tao sa itaas para idagdag sila.',
    'Your circle is your PassbookHub friends. Posts you share with “Circle” are visible only to them, and you can message anyone in your circle.': 'Ang circle mo ay ang mga kaibigan mo sa PassbookHub. Sila lang ang makakakita ng mga post na ibinahagi mo sa “Circle”, at puwede mong i-message ang kahit sino sa circle mo.',
    'Search people': 'Maghanap ng tao',
    'Your circle': 'Ang circle mo',

    // Messages
    'Loading messages…': 'Nilo-load ang mga mensahe…',
    'No messages yet.': 'Wala pang mensahe.',
    'Open your': 'Buksan ang',
    'circle': 'circle',
    'and tap Message to start a conversation.': 'mo at pindutin ang Mag-message para magsimula ng usapan.',
    'Loading…': 'Nilo-load…',
    'Unread': 'Hindi pa nababasa',
    'New message': 'Bagong mensahe',
    'Today': 'Ngayong araw',
    'Yesterday': 'Kahapon',
    'Loading conversation…': 'Nilo-load ang usapan…',
    'Person not found': 'Hindi nahanap ang tao',
    'Back to messages': 'Bumalik sa mga mensahe',
    'We could not load this conversation.': 'Hindi namin ma-load ang usapang ito.',
    'Delivered': 'Naihatid',
    'Sent': 'Naipadala',
    'Not seen yet': 'Hindi pa nakikita',
    'We could not download that file.': 'Hindi namin ma-download ang file na iyan.',
    'You': 'Ikaw',
    'You:': 'Ikaw:',
    'Download': 'I-download',
    'We could not open this attachment.': 'Hindi namin mabuksan ang attachment na ito.',
    'React to message': 'Mag-react sa mensahe',
    'React': 'Mag-react',
    'Unsend message': 'I-unsend ang mensahe',
    'Unsend': 'I-unsend',
    'Unsend message?': 'I-unsend ang mensahe?',
    'Yes, unsend': 'Oo, i-unsend',
    'Message unsent.': 'Na-unsend ang mensahe.',
    'We could not unsend that message.': 'Hindi namin ma-unsend ang mensaheng iyan.',
    'Edit message': 'I-edit ang mensahe',
    'Edit': 'I-edit',
    'Add a caption…': 'Maglagay ng caption…',
    'Save': 'I-save',
    'We could not edit that message.': 'Hindi namin ma-edit ang mensaheng iyan.',
    'Edited': 'Na-edit',
    'Search this chat': 'Maghanap sa chat na ito',
    'Older result': 'Mas lumang resulta',
    'Older': 'Mas luma',
    'Newer result': 'Mas bagong resulta',
    'Newer': 'Mas bago',
    'Close search': 'Isara ang paghahanap',
    'No results': 'Walang resulta',
    'Shared in this chat': 'Ibinahagi sa chat na ito',
    'Photos, videos and files': 'Mga larawan, video at file',
    'Photos': 'Mga Larawan',
    'Videos': 'Mga Video',
    'Files': 'Mga File',
    'No photos yet.': 'Wala pang larawan.',
    'No videos yet.': 'Wala pang video.',
    'No files yet.': 'Wala pang file.',
    'Send': 'Ipadala',
    'Photo or video': 'Larawan o video',
    'File': 'File',
    'Add photo, video or file': 'Magdagdag ng larawan, video o file',
    'Remove attachment': 'Alisin ang attachment',
    'We could not add that file.': 'Hindi namin maidagdag ang file na iyan.',
    'We could not send your message.': 'Hindi namin naipadala ang mensahe mo.',
    'You can only message people in your circle.': 'Ang mga nasa circle mo lang ang puwede mong i-message.',
    'to send a message.': 'para makapagpadala ng mensahe.',
    'Write a message first.': 'Sumulat muna ng mensahe.',
    'Sent a photo': 'Nagpadala ng larawan',
    'Sent a video': 'Nagpadala ng video',
    'Sent a file': 'Nagpadala ng file',
    'Files can be up to 5 MB.': 'Hanggang 5 MB lang ang mga file.',
    'This attachment is no longer available.': 'Hindi na available ang attachment na ito.',
    'Unsent a message': 'Nag-unsend ng mensahe',

    // Notifications
    'No notifications yet. When someone adds you to their circle, you will see it here.': 'Wala pang notipikasyon. Kapag may nagdagdag sa iyo sa circle nila, makikita mo ito rito.',
    'wants to add you to their circle.': 'ay gustong idagdag ka sa circle niya.',
    'accepted your circle request.': 'ay tinanggap ang circle request mo.',
    'Dismiss': 'Isara',

    // Dashboard
    'This month': 'Ngayong buwan',
    'Show category': 'Ipakita ang kategorya',
    'All categories': 'Lahat ng kategorya',
    'Add entry': 'Magdagdag ng entry',
    'Add an entry': 'Magdagdag ng entry',
    'Category': 'Kategorya',
    'Description': 'Paglalarawan',
    'Date': 'Petsa',
    'Take-home pay after tax, from any source.': 'Take-home pay pagkatapos ng buwis, mula sa kahit anong pinagkukunan.',
    'Enter a description.': 'Maglagay ng paglalarawan.',
    'Enter an amount above zero.': 'Maglagay ng halagang higit sa zero.',
    'That amount is too large.': 'Masyadong malaki ang halagang iyan.',
    'Enter a valid date.': 'Maglagay ng tamang petsa.',
    'Entry updated.': 'Na-update ang entry.',
    'We could not save this entry.': 'Hindi namin ma-save ang entry na ito.',
    'Edit entry': 'I-edit ang entry',
    'We could not delete this entry.': 'Hindi namin mabura ang entry na ito.',
    'Entry deleted.': 'Nabura ang entry.',
    'Undo': 'I-undo',
    'We could not restore this entry.': 'Hindi namin maibalik ang entry na ito.',
    'No target yet': 'Wala pang target',
    'Goal met': 'Naabot ang goal',
    'Add income': 'Magdagdag ng kita',
    'Change currency': 'Palitan ang currency',
    'Income': 'Kita',
    'Spent and saved': 'Nagastos at naipon',
    'Over income by': 'Lampas sa kita ng',
    'Left to assign': 'Natitirang ilalaan',
    'No entries in this category.': 'Walang entry sa kategoryang ito.',
    'Delete': 'Burahin',
    'Monthly summary': 'Buwanang buod',
    'Previous month': 'Nakaraang buwan',
    'Next month': 'Susunod na buwan',
    'Entries': 'Mga Entry',
    'Export CSV': 'I-export ang CSV',
    'Your data is saved to your account, so you can sign in from any device.': 'Naka-save ang data mo sa account mo, kaya puwede kang mag-sign in mula sa kahit anong device.',
    'Needs': 'Pangangailangan',
    'Wants': 'Gusto',
    'Savings': 'Ipon',
    'Rent, groceries, utilities, transport, minimum debt payments.': 'Upa, grocery, kuryente at tubig, pamasahe, minimum na bayad sa utang.',
    'Dining out, hobbies, shopping, subscriptions, travel.': 'Pagkain sa labas, hobby, shopping, subscription, pagbiyahe.',
    'Emergency fund, investments, extra debt payments.': 'Emergency fund, investment, dagdag na bayad sa utang.',

    // Errors from the server and validation
    'That email is taken.': 'May gumagamit na ng email na iyan.',
    'We could not reach the server. Check your connection and try again.': 'Hindi namin maabot ang server. Tingnan ang connection mo at subukan ulit.',
    'Too many attempts. Wait a few minutes and try again.': 'Masyadong maraming subok. Maghintay ng ilang minuto at subukan ulit.',
    'Use a stronger password with at least 8 characters.': 'Gumamit ng mas matibay na password na may hindi bababa sa 8 character.',
    'For your security, enter your password again.': 'Para sa seguridad mo, ilagay ulit ang password mo.',
    'You do not have permission to do that.': 'Wala kang pahintulot na gawin iyan.',
    'Use 60 characters or fewer.': 'Gumamit ng 60 character o mas kaunti.',
    'Enter your birthday.': 'Ilagay ang kaarawan mo.',
    'Enter a valid birthday.': 'Maglagay ng tamang kaarawan.',
    'Use 3 to 20 letters, numbers or underscores.': 'Gumamit ng 3 hanggang 20 letra, numero o underscore.',
    'Use at least 8 characters.': 'Gumamit ng hindi bababa sa 8 character.',
    'Use 128 characters or fewer.': 'Gumamit ng 128 character o mas kaunti.',
    'That username is taken.': 'May gumagamit na ng username na iyan.',
    'That email already has an account. Sign in instead.': 'May account na ang email na iyan. Mag-sign in na lang.',
    'That email already has a PassbookHub account. Sign in the way you did before (email and password or Google).': 'May PassbookHub account na ang email na iyan. Mag-sign in sa paraang ginamit mo dati (email at password o Google).',
    'This sign-in option is not available yet. Use your email and password for now.': 'Hindi pa available ang paraang ito ng pag-sign in. Gamitin muna ang email at password mo.',
    'This sign-in option is not available on this website yet. Use your email and password for now.': 'Hindi pa available ang paraang ito ng pag-sign in sa website na ito. Gamitin muna ang email at password mo.',
    'This account has been turned off.': 'Naka-off na ang account na ito.',
    'You are signed out. Sign in again.': 'Naka-sign out ka. Mag-sign in ulit.',
    'That password is not correct.': 'Mali ang password na iyan.'
  };

  /* Strings built around a name, number or date. Each returns the Filipino text or null. */
  const PATTERNS = [
    [/^Continue with (.+)$/, 'Magpatuloy gamit ang $1'],
    [/^Opening (.+)…$/, 'Binubuksan ang $1…'],
    [/^You must be (\d+) or older\.$/, 'Dapat $1 taong gulang ka pataas.'],
    [/^You must be (\d+) or older to use PassbookHub\.$/, 'Dapat $1 taong gulang ka pataas para magamit ang PassbookHub.'],
    [/^(.+) in (\d+)s$/, function (m) { return tr(m[1]) + ' sa loob ng ' + m[2] + 's'; }],
    [/^We sent a link to (.+?)\. Open it to verify your account, then come back here\. Check your spam folder if you do not see it\.$/,
      'Nagpadala kami ng link sa $1. Buksan ito para ma-verify ang account mo, tapos bumalik dito. Tingnan ang spam folder kung hindi mo ito makita.'],
    [/^If (.+?) has an account, a reset link is on its way\. Open it to choose a new password, then sign in\. Check your spam folder if you do not see it\.$/,
      'Kung may account ang $1, papunta na ang reset link. Buksan ito para pumili ng bagong password, tapos mag-sign in. Tingnan ang spam folder kung hindi mo ito makita.'],
    [/^(\d+) of (\d+) characters$/, '$1 sa $2 na character'],
    [/^Welcome, (.+)$/, 'Maligayang pagdating, $1'],
    [/^This permanently deletes your profile and every transaction\. (.+) will ask you to confirm it is you\.$/,
      'Permanenteng mabubura nito ang profile mo at lahat ng transaksyon. Hihilingin ng $1 na kumpirmahin na ikaw ito.'],
    [/^(\d+) new$/, '$1 bago'],
    [/^Now visible to: (.+)\.$/, function (m) { return 'Makikita na ng: ' + tr(m[1]) + '.'; }],
    [/^(Videos|GIFs|Files) can be up to 5 MB\. This one is (.+)\.$/, function (m) {
      return 'Hanggang 5 MB lang ang ' + ({ Videos: 'mga video', GIFs: 'mga GIF', Files: 'mga file' })[m[1]] + '. ' + m[2] + ' ang laki nito.';
    }],
    [/^What is on your mind, (.+)\?$/, 'Ano ang nasa isip mo, $1?'],
    [/^(\d+) in circle$/, '$1 sa circle'],
    [/^(.+) was removed from your circle\.$/, 'Inalis si $1 sa circle mo.'],
    [/^(.+) is now in your circle\.$/, 'Nasa circle mo na si $1.'],
    [/^Circle request sent to (.+)\. Tap to cancel\.$/, 'Naipadala na ang circle request kay $1. Pindutin para i-cancel.'],
    [/^Circle request sent to (.+)\.$/, 'Naipadala na ang circle request kay $1.'],
    [/^No one on PassbookHub has the username @(.+)\.$/, 'Walang user sa PassbookHub na may username na @$1.'],
    [/^You can see (.+)’s public posts\. Join their circle to see posts shared with their circle\.$/,
      'Nakikita mo ang mga public post ni $1. Sumali sa circle niya para makita ang mga post na para sa circle niya.'],
    [/^View (.+)’s profile$/, 'Tingnan ang profile ni $1'],
    [/^Add (.+) to your circle$/, 'Idagdag si $1 sa circle mo'],
    [/^Accept (.+)’s circle request$/, 'Tanggapin ang circle request ni $1'],
    [/^(.+) wants to add you · Tap to accept$/, 'Gusto kang idagdag ni $1 · Pindutin para tanggapin'],
    [/^No one found for “(.+)”\.$/, 'Walang nahanap para sa “$1”.'],
    [/^(.+) · Messages · PassbookHub$/, '$1 · Mga Mensahe · PassbookHub'],
    [/^(.+) · PassbookHub$/, function (m) { return tr(m[1]) + ' · PassbookHub'; }],
    [/^Conversation with (.+)$/, 'Usapan kasama si $1'],
    [/^Seen by (.+?) · (.+)$/, function (m) { return 'Nakita ni ' + m[1] + ' · ' + tr(m[2]); }],
    [/^Delivered to (.+) · not seen yet$/, 'Naihatid kay $1 · hindi pa nakikita'],
    [/^Seen (.+)$/, 'Nakita $1'],
    [/^Play video (.+)$/, 'I-play ang video na $1'],
    [/^Open photo (.+)$/, 'Buksan ang larawang $1'],
    [/^Download (.+)$/, 'I-download ang $1'],
    [/^Play (.+)$/, 'I-play ang $1'],
    [/^Open (.+)$/, 'Buksan ang $1'],
    [/^Reactions: (.+?)\. Click to remove your reaction\.$/, 'Mga reaction: $1. I-click para alisin ang reaction mo.'],
    [/^Reactions: (.+)$/, 'Mga reaction: $1'],
    [/^(.+) · Click to remove yours$/, '$1 · I-click para alisin ang sa iyo'],
    [/^React (.+)$/, 'Mag-react ng $1'],
    [/^(.+) · Edited (.+)$/, '$1 · Na-edit $2'],
    [/^This removes the message for you and (.+)\. You can’t undo this\.$/, 'Mabubura ang mensahe para sa iyo at kay $1. Hindi na ito maibabalik.'],
    [/^Say hi to (.+)\. Only the two of you can see this conversation\.$/, 'Mag-hi kay $1. Kayong dalawa lang ang makakakita ng usapang ito.'],
    [/^Preparing (.+)…$/, 'Inihahanda ang $1…'],
    [/^Sending (.+)…$/, 'Ipinapadala ang $1…'],
    [/^Message (.+)$/, 'I-message si $1'],
    [/^Amount \((.+)\)$/, 'Halaga ($1)'],
    [/^(.+) entry added to (.+)\.$/, function (m) { return 'Naidagdag ang entry sa ' + tr(m[1]) + ' para sa ' + m[2] + '.'; }],
    [/^(.+) entry added\.$/, function (m) { return 'Naidagdag ang entry sa ' + tr(m[1]) + '.'; }],
    [/^Almost at limit, (.+) left$/, 'Malapit na sa limit, $1 na lang ang natitira'],
    [/^Goal met, (.+) above$/, 'Naabot ang goal, sobra ng $1'],
    [/^(.+) over$/, 'Lampas ng $1'],
    [/^(.+) to go$/, '$1 pa'],
    [/^(\d+)% of income$/, '$1% ng kita'],
    [/^(Needs|Wants|Savings) used$/, function (m) { return 'Nagamit sa ' + tr(m[1]); }],
    [/^Add your take-home income for (.+) to see your 50\/30\/20 targets\.$/, 'Ilagay ang take-home income mo para sa $1 para makita ang 50/30/20 targets mo.'],
    [/^Amounts are in (.+)\.$/, 'Nasa $1 ang mga halaga.'],
    [/^No entries for (.+) yet\.$/, 'Wala pang entry para sa $1.'],
    [/^Edit (.+)$/, 'I-edit ang $1'],
    [/^Delete (.+)$/, 'Burahin ang $1'],
    [/^Use (\d+) characters or fewer\.$/, 'Gumamit ng $1 na character o mas kaunti.'],
    [/^Your (.+) account has no email address\. Sign up with your email instead\.$/, 'Walang email address ang $1 account mo. Mag-sign up na lang gamit ang email mo.'],
    [/^Account not deleted\. Confirm with (.+) to delete it\.$/, 'Hindi nabura ang account. Kumpirmahin gamit ang $1 para burahin ito.'],
    [/^You: (.+)$/, function (m) { return 'Ikaw: ' + tr(m[1]); }]
  ];

  function tr(text) {
    if (Object.prototype.hasOwnProperty.call(FIL, text)) return FIL[text];
    for (let i = 0; i < PATTERNS.length; i++) {
      const m = text.match(PATTERNS[i][0]);
      if (m) {
        const out = PATTERNS[i][1];
        return typeof out === 'function' ? out(m) : text.replace(PATTERNS[i][0], out);
      }
    }
    return text;
  }

  /* Keeps leading and trailing spaces, translates the middle. */
  function t(text) {
    if (code === 'en' || typeof text !== 'string') return text;
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m[2]) return text;
    const out = tr(m[2]);
    return out === m[2] ? text : m[1] + out + m[3];
  }

  window.I18N = {
    name: name,
    code: code,
    locale: code === 'fil' ? 'fil-PH' : undefined,
    languages: Object.keys(LANGS),
    t: t,
    set: function (next) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (error) { /* storage may be off */ }
    }
  };

  if (code === 'en') return;
  document.documentElement.lang = 'fil';

  /* User content is left exactly as written. */
  const SKIP = '.post-text, .bubble, .profile-bio, .tx-desc, textarea, script, style, [data-no-translate]';
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

  function skip(el) { return !el || (el.closest && el.closest(SKIP)); }

  /* Chat previews show the other person's words; only the app's own "Sent a photo" style labels change. */
  const PREVIEW = { 'Sent a photo': 1, 'Sent a video': 1, 'Sent a file': 1, 'Unsent a message': 1 };

  function doText(node) {
    const parent = node.parentElement;
    if (skip(parent)) return;
    if (parent.closest('.chat-last') && !PREVIEW[node.nodeValue.trim()]) return;
    const next = t(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  function doAttrs(el) {
    if (skip(el)) return;
    for (let i = 0; i < ATTRS.length; i++) {
      const value = el.getAttribute(ATTRS[i]);
      if (value) {
        const next = t(value);
        if (next !== value) el.setAttribute(ATTRS[i], next);
      }
    }
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 || skip(node)) return;
    doAttrs(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) doText(n); else doAttrs(n);
    }
  }

  const observer = new MutationObserver(function (records) {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttrs(r.target);
    }
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS
  });
  walk(document.body);
  document.title = t(document.title);
})();
