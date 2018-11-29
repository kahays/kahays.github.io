// putting it together
(function(){
	/* include guard, kinda */
	if (!document.location.hostname.includes("librarything") || window.catalogHelperTool && window.catalogHelperTool.installed) {
		return;
	} else {
		window.catalogHelperTool = {
			installed: true,
			ajaxSubmit: submitThroughAjax
		};
	}

	/* from the controlled vocabulary list */
	var approvedTags = ["alcohol / drugs", "anarchist", "animal rights", "audiozine", "bicycle", "catalog", "colorado", "coloring book", "comics", "dreams", "education", "family", "fashion", "feminism", "fiction", "film", "food", "foreign language", "general arts", "grammar / vocab", "health", "history", "how to / diy", "humor", "interview", "labor", "medley", "miscellaneous", "music", "perzine", "pirates", "poetry", "politics", "prison", "queer", "race", "race / culture", "rape", "relationships", "religion", "review", "reviews", "science", "science fiction", "series", "sex", "split zines", "sports", "survivors", "transgender", "travel", "visual art", "work"];

	/* resetting is more complicated than just form.reset(), which would lead to all kinds of inconsistent data. */
	function resetForms() {
		jQuery("#book_editForm, #pictureUpload").trigger("reset");

		/* clear autocomplete tags */
		jQuery("#autotag_autocomplete").change();

		/* select 'Your library' in collections, remove other collection */
		liveLibraryCollection().add(stubLibraryCollection()).find("input").prop("checked", true);
		liveSubcollections().add(stubSubcollections()).find("input").prop("checked", false);
		identifiers.collection = null;
		identifiers.updateUICollection();
		identifiers.updateForm();

		/* remove text in "From where?" */
		jQuery("[id^=location]").html('<div style="margin-bottom: 10px;"><a href="#" onclick="booklocation_edit(0,0); return false" class="alwaysblue">(change)</a></div>');
	}

	/* handles the syncing of collection and tags within the form and ui */
	var identifiers = {
		collectionPreservedCase: null,
		collection: null,
		tags: []
	};
	identifiers.separator = ", ";
	identifiers.regexSeparator = /,\s*/;
	identifiers.changeCollection = function(c) {
		this.collectionPreservedCase = c;
		c = c.toLowerCase();

		var position = this.tags.indexOf(c);
		if (position !== -1) {
			this.tags[position] = this.collection;
			this.collection = c;
			this.updateUITags();
		} else {
			this.collection = c;
		}

		this.updateUICollection();
		this.updateForm();
	};
	identifiers.retrieveTags = function(field) {
		this.tags = jQuery(field).val().split(this.regexSeparator).filter(function(s){ return s.length > 0; });
	};
	identifiers.updateUICollection = function() {
		if (this.collection !== null && this.collection.length) {
			jQuery("#autotag").text(this.collection + this.separator).show();

			/* other call number */
			jQuery("#form_btc_callnumber").val( this.collectionPreservedCase );

			/* the appropriate checkbox */
			liveSubcollections().find("input").prop("checked", false);
			liveSubcollections().find(":contains('" + this.collectionPreservedCase + "') input").prop("checked", true);

			/* if programmatically changed, visually reflect the change! */
			var collectionRadioButton = stubSubcollections().find(":contains('" + this.collectionPreservedCase + "') input");
			if (!collectionRadioButton.prop('checked')) {
				stubSubcollections().find("input").prop("checked", false);
				collectionRadioButton.prop("checked", true);

				if (!collectionRadioButton.is(":visible")) {
					var hidingContainer = jQuery(".collectionsCheckMenu > [id^=ult_]");
					jQuery(".collectionsCheckMenu > *").filter(stubSubcollections()).prependTo(hidingContainer);
					collectionRadioButton.closest(".cb.radioStub").insertBefore(hidingContainer);
				}
			}
		} else {
			jQuery("#form_btc_callnumber").val("");
			jQuery("#autotag").hide();
		}
	};
	identifiers.updateUITags = function() {
		jQuery("#autotag_autocomplete").val( this.tags.join(this.separator) );
	};
	identifiers.updateForm = function() {
		jQuery("#form_tags").val( [this.collection].concat(this.tags).join(', ') );
	};

	/* utility functions for the radio/checkbox ui */
	function liveLibraryCollection() { return jQuery(".cb:not(.radioStub):contains('Your library')"); }
	function liveSubcollections() { return jQuery(".cb:not(.radioStub):not(:contains('Your library'))"); }
	function stubLibraryCollection() { return jQuery(".cb.radioStub:contains('Your library')"); }
	function stubSubcollections() { return jQuery(".cb.radioStub:not(:contains('Your library'))"); }

	/* hiding the fields we don't use */
	jQuery("#ratingstdtitle, #form_review, #bookedit_publication, #bookedit_ISBN, #bookedit_weights, tr:contains('Convert all physical measurements to'), #ajaxinc_books_readdates, #bookedit_lccallnumber, #bookedit_dewey, #bookedit_privatecomment").closest("tr").hide();
	jQuery("#form_date").hide();
	jQuery("input[name='thickness'], td.bookEditHint:contains('thickness')").hide();
	jQuery("#ajaxinc_books_readdates").closest("tr").nextUntil(":contains('From where?')").hide();
	jQuery("#bookedit_privatecomment").closest("tr").nextUntil(":contains('Summary')").hide();
	jQuery("tr.section:contains('Identifiers'), tr.section:contains('Identifiers') ~ tr").hide();

	/* auto-parse the title field to populate volume and comment fields. */
	var titleVolumeAndIssueRegex = new RegExp(/Vol\.\s+(\d+|[ivxldcmIVXLDCM]+|Z+)(,?\s+No\.\s+(\d+|[ivxldcmIVXLDCM]+|Z+))?$/);
	var commentsVolumeAndIssueRegex = new RegExp(/((Volume\s+(\d+|[ivxldcmIVXLDCM]+|Z+)(,\s+Issue\s+(\d+|[ivxldcmIVXLDCM]+|Z+))?)|(Number\s+(\d+|[ivxldcmIVXLDCM]+|Z+)))\.$/);

	/* auto-parse the title field to populate volume and comment fields. */
	jQuery("#form_title").on("change.parseVolumeAndIssue", function(){
		var validVolume = false;
		var parseTitle = titleVolumeAndIssueRegex.exec( jQuery(this).val() );
		if (parseTitle) {
			var parsedVolume = parseAsIntOrRomanNumeral(parseTitle[1]);
			/* will return NaN for undefined values, so this works even without a later match */
			var parsedNumber = parseAsIntOrRomanNumeral(parseTitle[3]);

			if (!isNaN(parsedVolume)) {
				validVolume = true;
				jQuery("#numVolumes").val(parsedVolume);

				if (!isNaN(parsedNumber)) {
					var newVolumeAndIssue = "Volume " + parsedVolume + ", Issue " + parsedNumber + ".";
				} else {
					var newVolumeAndIssue = "Number " + parsedVolume + ".";
				}

				var comments = jQuery("#form_comments").val() || "";
				if (commentsVolumeAndIssueRegex.test(comments)) {
					comments = comments.replace(commentsVolumeAndIssueRegex, newVolumeAndIssue); 
				} else {
					/* append as though from scratch */
					comments += (comments.length && comments[comments.length-1] != " " ? " " : "") + newVolumeAndIssue;
				}
				jQuery("#form_comments").val(comments).change();
			}
		}

		if (!validVolume) {
			jQuery("#numVolumes").val(1);

			/* strip out superfluous Volume X, Issue Y from comments */
			var comments = jQuery("#form_comments").val() || "";
			if (commentsVolumeAndIssueRegex.test(comments)) {
				comments = comments.replace(commentsVolumeAndIssueRegex, ""); 
				jQuery("#form_comments").val(comments).change();
			}
		}
	});

	/* as long as it's a jumbled bag of numerals, we don't care if they're valid. just chug ahead. */
	function parseAsIntOrRomanNumeral(s){
		if (typeof s !== 'undefined' && new RegExp(/[IVXLCDM]+/i).test(s)) {
			var romanNumeralValues = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
			var result = s
				.toUpperCase()
				.split('')
				.map(function(c){ return romanNumeralValues[c]; })
				.reduceRight(function(acc, curr) {
					var newTotal = acc.total;
					var newHighest = acc.highest;

					if (curr >= newHighest) {
						newTotal += curr;
						if (curr > newHighest) {
							newHighest = curr;
						}
					} else {
						newTotal -= curr;
					}

					return { total: newTotal, highest: newHighest };
				}, { total: 0, highest: 0 })
				.total;
		} else {
			var result = parseInt(s, 10);
		}
		return result;
	}

	/* note beneath title field that it will be parsed for volume and issue data. */
	jQuery("#form_title")
	  .closest("tr.visible")
	  .after('<tr><td></td><td class="bookEditHint bookeditfield">Volume and issue information (when formatted using cataloging rules) will automatically fill other fields.</td></tr>')
	  .find("td.bookeditfield")
	    .removeClass("bookeditfield");

	/* make it clear that the number of volumes is no longer manually adjusted. */
	jQuery("#numVolumes")
	  .attr("readonly", true)
	  .addClass("readonly")
	  .closest("tr")
	    .after('<tr><td></td><td class="bookEditHint bookeditfield">Number of volumes will automatically match the volume specified in the title (see cataloging rules)</td></tr>')
	    .find("td.bookeditfield")
	      .removeClass("bookeditfield");

	/* automatically match the summary and comments field */
	jQuery("#form_summary").attr("readonly", "readonly").addClass("readonly");
	jQuery("#form_comments").on("change keyup", function(){ jQuery("#form_summary").val( jQuery(this).val() ); });
	jQuery(".bookEditHint:contains('summary')").text("Summary will automatically match the Comments field");

	/* create our readonly field for autotagging */
	jQuery("<span id='autotag' class='catalogHelperTool bookEditInput' style='width: fit-content; display: inline-block; vertical-align: inherit; padding: 2px 4px; border-right-width: 0; color: gray;'></span>").insertBefore("#form_tags").hide();

	/* destructively prevent re-establishment of vanilla autocomplete */
	jQuery(document).off("focus", "[data-autocomplete]");
	if (jQuery("#form_tags").autocomplete("instance")) {
		jQuery("#form_tags").autocomplete("destroy");
	}

	/* the user will use a restricted autocomplete box */
	jQuery("#form_tags")
	  .clone()
	  .attr("id", "autotag_autocomplete")
	  .addClass("catalogHelperTool")
	  .removeAttr("name")
	  .width("calc(95% - 8em)")
	  .insertBefore("#form_tags")
	  .end()
	.hide();

	/* our custom autocomplete box -- basically from a jQuery UI example */
	jQuery('#autotag_autocomplete').autocomplete({
		source: function(request, response) {
			var word = request.term.split(/,\s*/).pop();
			response( jQuery.grep(
				approvedTags.filter(function(s){ return s !== jQuery("#autotag").text().split(/,\s*/)[0]; }),
				function(item){
					return new RegExp("^" + jQuery.ui.autocomplete.escapeRegex(word), "i").test(item);
				}
			) );
		},
		focus: function() {
			return false;
		},
		minLength: 0,
		select: function(event, ui) {
			var terms = this.value.split(/,\s*/);
			terms.pop();
			terms.push( ui.item.value );
			terms.push( "" );
			this.value = terms.join( ", " );
			return false;
		}
	}).on("change", function(){
		identifiers.retrieveTags(jQuery(this));
		identifiers.updateForm();
	});

	/* place collections before tags */
	jQuery("#collectionstdtitle").closest("tr").insertBefore(jQuery("#bookedit_tags").closest("tr"));

	/* the call number will be set automatically by the collection */
	jQuery("#form_btc_callnumber")
	 .attr("readonly", "readonly")
	 .addClass("readonly")
	 .after('<br><span class="bookEditHint">Other call number will automatically match the selected collection.</span>')
	 /* small visual fix so the call number appears with the same indent as other fields */
	 .closest("tr").find("td.left.subitemtitle").removeClass("subitemtitle");

	/* stub out our radio buttons */
	liveSubcollections().each(function(){
		jQuery( this ).clone(true)
		  .addClass("radioStub")
		  .find("input")
		    .removeAttr("id value onclick")
		    .attr("name", "radioStub")
		    .prop("type", "radio")
		  .click(function(){ identifiers.changeCollection( jQuery(this).next(".lab").text() ); })
		  .end()
		.insertAfter(jQuery( this ));
	}).hide();

	/* make sure we're adding to our library */
	liveLibraryCollection()
	  .find("input").prop("checked", true).end()
	  .hide();
	jQuery(".collectionsCheckMenu").prepend("<div class='cb radioStub'><label><input type='checkbox' checked disabled> <span class='lab'>Your library</span></label></div>");

	/* start out with only one collection */
	var firstCheckedCollection = liveSubcollections().find("input[checked]").first().next(".lab").text();
	identifiers.changeCollection(firstCheckedCollection);

	/* constrain the publication dates to what's in the guide */
	var yearPicker = jQuery("<div class='publicationDateHelper'><select class='catalogHelperTool publishedYear bookEditInput' style='width: fit-content;'></select></div>").insertAfter("#form_date").find(".publishedYear");
	yearPicker.append("<option></option");
	for (var earliestYear = 1950, year = new Date().getFullYear(); year >= earliestYear; --year) {
		yearPicker.append("<option>" + year + "</option>");
	}
	yearPicker.after("<select class='catalogHelperTool publishedMonth bookEditInput readonly' disabled style='width: fit-content;'><option></option><optgroup label='Month'><option>January</option><option>February</option><option>March</option><option>April</option><option>May</option><option>June</option><option>July</option><option>August</option><option>September</option><option>October</option><option>November</option><option>December</option></optgroup><optgroup label='Season'><option>Spring</option><option>Summer</option><option>Fall</option><option>Winter</option></optgroup></select>");

	/* disable the month unless there's an actual year */
	jQuery(document)
	  .on("change.accessibility", ".publishedYear", function() {
		var that = jQuery(this);
		if (that.val().length === 0) {
			that.next(".publishedMonth").val("").addClass("readonly").prop("disabled", true);
		} else {
			that.next(".publishedMonth").removeClass("readonly").prop("disabled", false);
		}
	  })
	/* update the form based on our <select>s */
	  .on("change.updateForm", ".publishedYear, .publishedMonth", function() {
		jQuery("#form_date").val(
			jQuery(".publishedYear")
			  .map(function(){
				return (jQuery(this).val() + " " + jQuery(this).next(".publishedMonth").val()).trim();
			  })
			  .get()
			  .filter(function(s){ return s.length > 0; })
			  .join(" / ")
		);
	  });

	/* we can add more publication dates! :o */
	jQuery("<div id='clonePublicationHelper' class='bookEditHint'><a>add another publication date</a></div>")
	  .find("a")
	  .click(addPublicationDate)
	  .end()
	  .appendTo("#bookedit_date");
	function addPublicationDate() {
		jQuery(".publicationDateHelper")
		  .first()
		  .clone()
		  .insertBefore("#clonePublicationHelper")
		  .find(".publishedYear")
		  .change();
		return false;
	}

	/* Only allow numeric input for pagination. */
	jQuery("select[name=pagetype]")
	  .find("option:contains('1,2,3')")
	  .attr('selected', 'selected')
	  .siblings("option")
	  .detach();
	/* Only inches for dimensions. */
	jQuery("select[name=d-unit]")
	  .find("option:contains('inch')")
	  .attr('selected', 'selected')
	  .siblings("option")
	  .detach();

	/* Add some shortcut buttons for dimension entry. */
	jQuery("tr:contains('Dimensions') fieldset").after(
		'<div id="quicksizeselect">\
			<span style="display: inline-block;">\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 136px; height: 176px; cursor: pointer;">11 x 8.5</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 88px; height: 136px; cursor: pointer;">8.5 x 5.5</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 68px; height: 88px; cursor: pointer;">5.5 x 4.25</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 44px; height: 68px; cursor: pointer;">4.25 x 2.75</button>\
			</span>\
			<span style="display: inline-block;">\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 176px; height: 136px; cursor: pointer;">8.5 x 11</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 136px; height: 88px; cursor: pointer;">5.5 x 8.5</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 88px; height: 68px; cursor: pointer;">4.25 x 5.5</button>\
			<button type="button" style="margin-top: 5px; vertical-align: bottom; width: 68px; height: 44px; cursor: pointer;">2.75 x 4.25</button>\
			</span>\
		</div>');
	function sizeToDimension(s){ return s.split('x').map(function(x){ return parseFloat(x, 10); }); }
	var heightInput = jQuery("input[name='forcesave_height'").next("td").find("input");
	var widthInput = jQuery("input[name='forcesave_length'").next("td").find("input");

	jQuery("#quicksizeselect button").each(function(i){
		this.onclick = function() {
			var d = sizeToDimension(jQuery(this).text());
			heightInput.val(d[0]);
			widthInput.val(d[1]);
		};
	});

	/* Add physical summary fields. */
	jQuery("#bookedit_phys_dims")
	  .closest("tr")
	  .after('\
		<tr id="physicalsummaryhelper">\
		<td class="left">Physical summary</td>\
		<td>\
		<fieldset style="width: 95%; padding: 0.5em 0 0.5em 1.5em; margin-bottom: 1em; border: 1px solid #D3D0C3; -webkit-border-radius: 5px; -moz-border-radius: 5px;">\
			<legend style="margin-left: -1.25em; padding: 0 0.25em; border: 1px solid white; -webkit-border-radius: 3px; background-color: white;"><input type="checkbox" id="catalogHelperPhysicalDescAutoToggle" value="" checked> Generate automatically</legend>\
			<label><input type="radio" name="catalogHelperPhysicalDescColor" value="" checked="">Black and white</label>\
			<label><input type="radio" name="catalogHelperPhysicalDescColor" value="some color">Some color</label>\
			<label><input type="radio" name="catalogHelperPhysicalDescColor" value="full color">Full color</label>\
			<br>\
			<label><input type="checkbox" value="illustrations"> Illustrations</label><br>\
			<label><input type="checkbox" value="photographs"> Photographs</label><br>\
		</fieldset>\
		<textarea name="phys_summary" id="phys_summary" rows="2" class="bookEditInput readonly" readonly></textarea>\
		<div class="book_itemBottomControl bookEditHint" style="padding: 3px; width: 95%;">\
			<span style="float: left;">This field automatically updates but can also be manually edited.</span>\
			<a style="float: right;" href="javascript:expandMe("phys_summary")">more space</a>\
		</div>\
		</td>\
	</tr>\
	  ');
	var physicalSummarySourceFields = jQuery("[name=pagecount], [name=height], [name=length_dim], #physicalsummaryhelper input:not(#catalogHelperPhysicalDescAutoToggle)");
	jQuery("#catalogHelperPhysicalDescAutoToggle")
	  .change(toggleAutoupdatePhysicalSummary)
	  .change();

	function toggleAutoupdatePhysicalSummary(){
		var isAuto = jQuery("#catalogHelperPhysicalDescAutoToggle").is(":checked");
		if (isAuto) {
			jQuery("#physicalsummaryhelper")
			  .find("fieldset")
			    .removeAttr("disabled")
			    .removeClass("readonly")
			    .end()
			  .find("legend")
			    .css("borderColor", "white")
			    .end()
			  .find("#phys_summary")
			    .attr("readonly", true)
			    .addClass("readonly");
			jQuery(physicalSummarySourceFields).on("change.updatePhysicalSummary", updatePhysicalSummary).first().change();
		} else {
			jQuery("#physicalsummaryhelper")
			  .find("fieldset")
			    .attr("disabled", true)
			    .addClass("readonly")
			    .end()
			  .find("legend")
			    .css("borderColor", "#CCC")
			    .end()
			  .find("#phys_summary")
			    .removeAttr("readonly")
			    .removeClass("readonly");
			jQuery(physicalSummarySourceFields).off("change.updatePhysicalSummary");
		}
	}

	function updatePhysicalSummary(){
		var summary = [];

		var pages = jQuery("[name=pagecount]").val();
		if (pages.length) {
			summary.push(pages + " p.");
		}
		var height = jQuery("[name=height]").val();
		var length = jQuery("[name=length_dim]").val();
		if (height.length) {
			summary.push( [height, length].filter(isNonemptyString).join(' x ') + " inches" );
		}

		/* descriptions and such */
		summary.push(
		  jQuery("#physicalsummaryhelper input:checked")
		  .not("[value=]") /* filter out the "black and white" checkbox */
		  .map(function(){ return jQuery(this).val(); })
		  .toArray()
		  .join(', ')
		  );

		summary = summary.filter(isNonemptyString).join('; ');
		jQuery("#phys_summary").val(summary);
		function isNonemptyString(s) { return s.length; }
	}

	/* Support simultaneous picture upload. */
	jQuery("#book_editForm")
	  .before('<div><form enctype="multipart/form-data" action="/upload_arbitrarypic.php" method="post" id="pictureUpload"><input type="hidden" name="item" value=""><input type="hidden" name="MAX_FILE_SIZE" value="8388608"><input type="hidden" name="whichgallery" value="2"></form></div>')
	  .before('<div id="uploadProgress" style="display:none; text-align: center;"><h2></h2><img src="https://pics.cdn.librarything.com/pics/fbloader.gif"><p></p></div>');
	jQuery("#book_bookInformationTable > tbody").prepend('<tr><td class="left">Cover image</td><td class="bookeditfield"><input name="userfile" type="file" accept="image/*" form="pictureUpload"></td></tr>');
	/* We are overriding the action property because LibraryThing's onclick() JS fires the submit event and this is a hacky way to get the last word in. */
	jQuery("[name=editform]").prop("action", "javascript:window.catalogHelperTool.ajaxSubmit();");

	/* Where we scrape pages to find the ID of the submitted book and then send the cover image. */
	/* TODO: more detailed error handling -- even with system errors Library only returns success */
	function submitThroughAjax() {
		var uploadLightbox = {
			box: null,
			init: function(){ LibraryThing.lightbox.inline("uploadProgress", { width: 500, height: 150, modal: true }); this.box = jQuery("#LT_LB_content"); },
			dismiss: function(){ LibraryThing.lightbox.off(); },
			isLoading: function(){ this.box.find("img").show(); },
			notLoading: function(){ this.box.find("img").hide(); },
			setTitle: function(title){ this.box.find("h2").html(title); },
			setDescription: function(desc){ this.box.find("p").html(desc); },
			error: function(message, desc) {
				uploadLightbox.setTitle("Failed: " + message + ".");
				uploadLightbox.notLoading();
				if (desc) {
					uploadLightbox.setDescription(desc);
				} else {
					uploadLightbox.setDescription('Maybe the internet is not reachable? <a href="#" class="alwaysblue">Return to editing the book</a>.');					
				}
				uploadLightbox.box.find("a").click(this.dismiss);
			}
		};

		var coverImageSelected = (jQuery("[name=userfile]").val().length > 0);
		if (coverImageSelected || confirm("Add book without cover image?")) {
			uploadLightbox.init();

			/* Adding book. */
			uploadLightbox.setTitle("Adding book...");
			uploadLightbox.isLoading();
			jQuery.post("/update.php", jQuery("#book_editForm").serialize())
			  .fail(function(){ uploadLightbox.error("unable to add book"); })
			  .done(function() {
			  	/* Fetching book information. */
				uploadLightbox.setTitle("Fetching book information...");
				uploadLightbox.isLoading();
				
				jQuery.get("/response_list.php", {})
				  .fail(function(){
				  	uploadLightbox.error(
				  		"couldn't fetch new book information",
				  		'Information couldn\'t be found, but your book <a href="/catalog.php" target="_blank"><em>may</em> have been added already</a>. If not, you can <a href="#" class="alwaysblue">return to editing</a>.'
				  	);
				  	/* BUG: clicking on the link to the catalog also closes the lightbox. Not sure why, the below selector is not causing it. */
				  	uploadLightbox.box.find("a.alwaysblue").click(uploadLightbox.dismiss);
				  })
				  .done(function(data){
					var recentlyAddedBooks = jQuery(data);
					var newBookEntry = recentlyAddedBooks
					  .find("td.book a")
					  /* in case of race conditions, we try to get an exact match on titles */
					  .filter(function(){ return jQuery(this).text() === jQuery("#form_title").val(); })
					  /* fallback; just get the first book listed */
					  .add( recentlyAddedBooks.find("td.book h2 a").first() )
					  /* now the bit that makes the fallback work */
					  .first();
					var newBookLink = newBookEntry.prop("href");
					var newBookID = newBookLink.match(new RegExp(/book\/(\d+)/))[1];
					jQuery("#pictureUpload input[name=item]").val( newBookID );

					/* Uploading image. */
					uploadLightbox.setTitle("Uploading cover image...");
					uploadLightbox.isLoading();
					jQuery.ajax({
						url: jQuery("#pictureUpload").prop("action"),
						data: new FormData(jQuery("#pictureUpload")[0]),
						contentType: false,
						processData: false,
						type: "POST"
					})
					.fail(function(){ coverDidNotUpload(newBookLink); })
					.done(function(data) {
						var checkForSuccess = jQuery(data);

						if (checkForSuccess.find("h1:contains('Problem')").text() === "Problem") {
							coverDidNotUpload(newBookLink);
						} else {
							uploadLightbox.setTitle("Complete!");
							uploadLightbox.notLoading();
							uploadLightbox.setDescription('<a href="" target="_blank">See your new book</a> or <a href="#" class="alwaysblue">return to adding books</a>.');
							uploadLightbox.box
							  .find("a")
							  .first().attr('href', newBookLink.replace("book/", "details/")).end()
							  .last().click(function(){
								  resetForms();
								  uploadLightbox.dismiss();
								  return false;
							  });
						}
					  });
				  });
			  });
		}

		/* Graphical reset for the entry forms. */
		jQuery('#book_editTabTextSave1, #book_editTabTextSave2, #book_editTabTextEditCancel1, #book_editTabTextEditCancel2').css('display', 'unset');
		jQuery('#book_bookInformationTable').css('opacity', 'unset').css('filter', 'unset');

		function coverDidNotUpload(bookLink){
			uploadLightbox.error("couldn't upload cover image");
			uploadLightbox.setDescription('The <a href="" target="_blank">new book</a> was created but the cover couldn\'t be added. You can <a href="" target="_blank">add a cover directly</a> or <a href="#" class="alwaysblue">continue adding new books</a>.');
			uploadLightbox.box
			  .find("a")
			  .eq(0).attr('href', bookLink).end()
			  .eq(1).attr('href', bookLink.replace("book/", "covers/")).end()
			  .eq(2).click(function(){
				  resetForms();
				  uploadLightbox.dismiss();
				  return false;
			  });
		}
	}

	/* Support the ability to quickly copy info from another book (like the previous in a series.) */
	jQuery("#book_editForm").before('<div id="quickduplicatecontainer"> &#65279; <div id="quickduplicatesearch"> <form action="" method="get"><input type="text" placeholder="Find existing title to duplicate..."> <img src="https://pics.cdn.librarything.com/pics/sbar_3.png"><button type="button" style="margin-left: 8px;">Clear search results</button></form> </div> <div id="quickduplicateresults" style="max-height: 380px; overflow-y: auto;"></div></div>');
	jQuery("body").append('<style type="text/css" id="quickduplicatestyling">  #quickduplicatesearch input {  width: 25em;  padding: 0.25em 30px 0.25em 0.6em;  border: 1px solid #CCBFB0;  -webkit-border-radius: 8px;  color: #555;  }  #quickduplicatesearch img {  margin-left: -25px;  margin-bottom: -6px;  padding: 4px 8px 4px 0;  cursor: pointer;  }  #lt_catalog_list { width: 100%; }  #quickduplicateresults tr.odd td { background-color: inherit; }  #quickduplicateresults tr.odd { background-color: #ECE9DB; }  #quickduplicateresults tbody tr:hover { background-color: goldenrod; cursor: pointer; }  #quickduplicateresults td.cover, #quickduplicateresults td:last-of-type { padding-right: 1em; }  #quickduplicateresults .tablehead { font-weight: bold; }</style>');
	jQuery("#quickduplicatesearch")
	  .find("form")
	    .on('submit', function(){ quickDuplicateSearch(); return false; })
	    .end()
	  .find("img")
	    .click(quickDuplicateSearch)
	    .end()
	  .find("button")
	    .click(function(){ jQuery("#quickduplicateresults").empty(); });

	function quickDuplicateSearch() {
		var term = jQuery("#quickduplicatesearch input").val();
		if (!term.length) {
			return;
		}	

		output("Searching...");
		jQuery.get("/catalog_bottom.php", { 'deepsearch': term, 'view': 'DenverZine' })
			.done(function(data) {
				var results = jQuery(data).find("#lt_catalog_list");
				if (results.length) {
					/* preserve the links to books in a data attribute */
					results.find(".tools a[href*='/details/']").each(function(){
						jQuery(this).closest("tr").attr('data-book-detail-URI', jQuery(this).attr('href'));
					});

					/* don't need ratings, the toolbox, or extra cover controls */
					results.find(".coverControl, #head_rating, .stars, #head_toolpad, .toolpad").detach();
					/* now strip remaining links */
					results.find("a:not(.lt-title)").contents().unwrap();
					/* do our best to remove script handlers */
					results.find("[onclick], [ondblclick], [dblclick]").removeAttr('onclick ondblclick dblclick');

					results.find("a.lt-title").attr("target", "_blank").click(function(e){ e.stopPropagation(); });
					results.find("tbody tr").click(confirmCopyData);
					output(results);
				} else {
					output("No books found.");
				}
			})
		.fail(function(){
			output("Search results could not be loaded.");
		});

		/* verrry rough click-to-copy */
		function confirmCopyData(e) {
			if (confirm("Copy data from \"" + jQuery(e.currentTarget).find('td[id^="title"]').text() + "\"?")) {
				quickDuplicateCopy( jQuery(e.currentTarget).attr('data-book-detail-URI') );
			}
		}

		function output(a) {
			jQuery('#quickduplicateresults').empty().append(a);
		}
	}

	function quickDuplicateCopy(bookURI) {
		jQuery.post(
			"/ajax_bookInformationBlock.php",
			{
				work: bookURI.match(new RegExp(/work\/(\d+)/))[1],
				book: bookURI.match(new RegExp(/details\/(\d+)/))[1],
				book_startInEditMode: 1
			},
			function(data){
				var source = jQuery(data);

				/* set up additional "other authors" fields for immediate bulk copy */
				jQuery(".bookEditRole").remove();
				pcount = 1;
				jQuery(jQuery.find(".bookPersonName").last()).val('');
				jQuery(jQuery.find(".bookPersonRole").last()).val('');
				var desiredAuthorFields = +(source.find("#totalPersons").text());
				for (var i = 2; i < desiredAuthorFields; ++i){
					addPerson();
				}

				/* make sure we don't whack the physical summary that may be copied over. */
				jQuery("#catalogHelperPhysicalDescAutoToggle").prop("checked", false).change();

				/* bulk copy */
				jQuery(".bookEditInput:not(.catalogHelperTool)").each(function(){
					var t = jQuery(this);
					var u = null;
					/* this code is not only because the pagination field has id="" (WTF!), but because some fields are only identifiable by name. */
					if (t.attr("id") && (u = source.find("#" + t.attr("id"))).length ||
					    t.attr("name") && (u = source.find("[name=" + t.attr("name") + "]")).length) {
						t.val( u.val() );

						/* some <option> fields don't exist in the <selects> that are supposed to contain them. if so, we can create an <option> with values of the text we want and the backend will fix it up. */
						if (u.is("select") && t.val() !== u.val()) {
							var lastBlankValuedOption = t.find("[value=]").last();
							var newOptionValue = u.find("option:selected").text();
							var newOption = jQuery("<option></option").attr("value", newOptionValue).text(newOptionValue);
							if (lastBlankValuedOption.length) {
								lastBlankValuedOption.before(newOption);
							} else {
								t.append(newOption);
							}
							t.val( newOptionValue );
						}
					}
				});

				/* now some bulk cleanup */

				/* get our tags/collection/call number to populate */
				var newCollection = jQuery("#form_btc_callnumber").val();
				/* terrible hack. try to get a proper case collection if nothing was filled in. */
				if (!newCollection) {
					newCollection = jQuery('#form_tags').val().split(',')[0].trim();
					newCollection = newCollection.split(/\s+/).map(function(a){
						return a.split('').map(function(x,i){ return (i === 0) ? x.toUpperCase() : x; }).join('');
					}).join(' ');
				}
				var newTags = jQuery('#form_tags').val().split(',').map(function(x){ return x.trim(); }).slice(1).join(', ');
				identifiers.changeCollection(newCollection);
				jQuery("#autotag_autocomplete").val( newTags ).change();

				/* try to sorta-blank out volume/number info. */
				jQuery("#form_title, #form_comments").each(function(){
					function blankNumbers(match){
						return match.replace(/\d+/g, "ZZ");
					}

					var x = jQuery(this).val();
					/* Regular expressions were defined earlier. */
					if (titleVolumeAndIssueRegex.test(x)){
						jQuery(this).val( x.replace(titleVolumeAndIssueRegex, blankNumbers) );
					} else if (commentsVolumeAndIssueRegex.test(x)) {
						jQuery(this).val( x.replace(commentsVolumeAndIssueRegex, blankNumbers) );
					}
				}).change();

				/* publication date parsing. */
				var newDates = jQuery("#form_date").val().split('/');
				/* clear previous dates. */
				jQuery(".publicationDateHelper:last")
				  .siblings(".publicationDateHelper")
				  .remove()
				  .end()
				  .find(".publishedYear")
				  .change();
				for (var i = 0; i < newDates.length; ++i) {
					/* this regexp will only handle the month/season if we already had a valid year */
					var dateRegExp = /(\d{4})(?:\s+(January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Fall|Winter))?/;
					
					var parsed = dateRegExp.exec(newDates[i]);
					if (parsed !== null) {
						var dateHelper = jQuery(".publicationDateHelper").last();
						dateHelper.find(".publishedYear").val(parsed[1]).change();
						if (typeof parsed[2] !== "undefined") {
							dateHelper.find(".publishedMonth").val(parsed[2]).change();
						}
						jQuery("#clonePublicationHelper a").click();
					}
				}

				/* parse existing physical summary to make automatic transition easier */
				jQuery("#physicalsummaryhelper input:not(#catalogHelperPhysicalDescAutoToggle)")
				  .each(function(){
					  var summary = jQuery("#phys_summary");
					  var containsVal = new RegExp(jQuery(this).val(), "i").test( summary.val() );
					  jQuery(this).prop("checked", containsVal);
				  });

				/* location */
				var newLoc = source.find("[id^=location]").text().replace(/\s*\(change\)\s*$/, "");
				if (newLoc.length) {
					jQuery("[id^=location]")
					  .html('<div style="margin-bottom: 10px;"><a href="#" onclick="booklocation_edit(0,0); return false" class="alwaysblue">(edit)</a></div>')
					  .find("div")
					  .prepend(newLoc + " ");
				}
			});
	}
})();
