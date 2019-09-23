// Where Finder Main Display Functions
// This script is injected onto a webpage after the WFMainDisplay.html script in injected

$(function() {      // Draggable Main Box
    $("#WFMainBox" ).draggable();
});

$(function() {      // Close WhereFinder Box
    $('#WFCloseBoxButton').click(function(){
        $('#WFMainBox').hide();
    });
});

$(function() {          // Change WhereFinder Tab
    $('.WF_TabButtons').click(function(){
        $(".WF_TabBoxes").hide();
        $("#WFDisplayBox_" + this.value).show();            
        $('.WF_TabButtons').css('background-color', 'rgba(89, 88, 90, 0.377)');
        $('#WF' + this.value + 'TabButton').css('background-color', 'rgb(89, 88, 90)');
    });
});