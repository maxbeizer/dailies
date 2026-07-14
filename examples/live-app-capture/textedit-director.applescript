on run argv
	if (count of argv) is not 2 then error "expected an action and run token"
	set actionName to item 1 of argv
	set runToken to item 2 of argv

	if actionName is "prepare" then
		my resetCapture(runToken)
		tell application "TextEdit"
			activate
			make new document with properties {text:"Dailies can direct a running app." & return & captureMarker(runToken)}
		end tell
	else if actionName is "showOpening" then
		set captureDocument to my findCaptureDocument(runToken)
		tell application "TextEdit"
			set text of captureDocument to "The first take starts with a real application." & return & captureMarker(runToken)
		end tell
	else if actionName is "showRevision" then
		set captureDocument to my findCaptureDocument(runToken)
		tell application "TextEdit"
			set text of captureDocument to "The agent changed the app, and Dailies recorded the take." & return & captureMarker(runToken)
		end tell
	else if actionName is "reset" then
		my resetCapture(runToken)
	else
		error "unknown action: " & actionName
	end if
end run

on captureMarker(runToken)
	return "[dailies-live-capture:" & runToken & "]"
end captureMarker

on findCaptureDocument(runToken)
	tell application "TextEdit"
		repeat with candidateDocument in documents
			if text of candidateDocument contains my captureMarker(runToken) then return candidateDocument
		end repeat
	end tell
	error "Dailies capture document is not open"
end findCaptureDocument

on resetCapture(runToken)
	tell application "TextEdit"
		repeat with candidateDocument in documents
			if text of candidateDocument contains my captureMarker(runToken) then
				close candidateDocument saving no
				exit repeat
			end if
		end repeat
	end tell
end resetCapture
