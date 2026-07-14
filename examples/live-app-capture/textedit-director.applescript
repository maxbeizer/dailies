on run argv
	if (count of argv) is not 2 then error "expected an action and run token"
	set actionName to item 1 of argv
	set runToken to item 2 of argv

	if actionName is "prepare" then
		my resetCapture(runToken)
		tell application "TextEdit"
			activate
			if (count of documents) is 0 and (count of windows) > 0 then close window 1
			make new document with properties {text:"Dailies can direct a running app."}
			set name of front document to my captureDocumentName(runToken)
			set name of front window to "Dailies Live Capture"
			set bounds of front window to {120, 120, 920, 670}
		end tell
	else if actionName is "showOpening" then
		set captureDocument to my findCaptureDocument(runToken)
		my setCaptureText(captureDocument, "The first take starts with a real application.")
	else if actionName is "showRevision" then
		set captureDocument to my findCaptureDocument(runToken)
		my setCaptureText(captureDocument, "The agent changed the app, and Dailies recorded the take.")
	else if actionName is "reset" then
		my resetCapture(runToken)
	else
		error "unknown action: " & actionName
	end if
end run

on captureDocumentName(runToken)
	return "Dailies Live Capture " & runToken
end captureDocumentName

on setCaptureText(captureDocument, visibleText)
	tell application "TextEdit"
		set text of captureDocument to visibleText
	end tell
end setCaptureText

on findCaptureDocument(runToken)
	set expectedName to my captureDocumentName(runToken)
	tell application "TextEdit"
		repeat with candidateDocument in documents
			if name of candidateDocument is expectedName then return candidateDocument
		end repeat
	end tell
	error "Dailies capture document is not open"
end findCaptureDocument

on resetCapture(runToken)
	set expectedName to my captureDocumentName(runToken)
	tell application "TextEdit"
		repeat with candidateDocument in documents
			if name of candidateDocument is expectedName then
				close candidateDocument saving no
				exit repeat
			end if
		end repeat
	end tell
end resetCapture
